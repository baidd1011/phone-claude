import process from "node:process";
import { fileURLToPath } from "node:url";

import { spawn } from "node-pty";

export interface ProbeCommand {
  file: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export interface ProbeExitEvent {
  exitCode: number;
  signal?: number;
}

export interface Disposable {
  dispose(): void;
}

export interface PtyProcessLike {
  onData(listener: (data: string) => void): Disposable;
  onExit(listener: (event: ProbeExitEvent) => void): Disposable;
}

export type PtyFactory = (command: ProbeCommand) => PtyProcessLike;

export interface ProbeResult {
  output: string;
  exitCode: number;
  signal?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function defaultProbeCommand(): ProbeCommand {
  const file = process.env.PHONE_CLAUDE_CLAUDE_CMD?.trim() || "claude";
  const rawArgs = process.env.PHONE_CLAUDE_CLAUDE_ARGS?.trim() || "--version";
  const args = rawArgs.length === 0 ? [] : rawArgs.split(/\s+/);

  return {
    file,
    args,
    cwd: process.cwd(),
    env: Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    )
  };
}

export function createNodePtyFactory(): PtyFactory {
  return (command) =>
    spawn(command.file, command.args, {
      name: "xterm-color",
      cols: 120,
      rows: 30,
      cwd: command.cwd,
      env: command.env as Record<string, string>
    });
}

export async function runProbe(
  createPty: PtyFactory,
  command: ProbeCommand,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ProbeResult> {
  return await new Promise<ProbeResult>((resolve, reject) => {
    const ptyProcess = createPty(command);
    let output = "";
    let settled = false;

    let dataDisposable: Disposable | undefined;
    let exitDisposable: Disposable | undefined;

    const cleanup = (timeout: NodeJS.Timeout) => {
      clearTimeout(timeout);
      dataDisposable?.dispose();
      exitDisposable?.dispose();
    };

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup(timeout);
      reject(new Error(`PTY probe timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    dataDisposable = ptyProcess.onData((chunk) => {
      output += chunk;
    });

    exitDisposable = ptyProcess.onExit((event) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup(timeout);
      resolve({
        output,
        exitCode: event.exitCode,
        signal: event.signal
      });
    });
  });
}

async function main() {
  const result = await runProbe(createNodePtyFactory(), defaultProbeCommand());
  process.stdout.write(result.output);
  console.log(`\n[probe exit=${result.exitCode}]`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
