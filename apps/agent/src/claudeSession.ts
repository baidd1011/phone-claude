import process from "node:process";

import { spawn } from "node-pty";

export interface PtyExitEvent {
  exitCode: number;
  signal?: number;
}

export interface Disposable {
  dispose(): void;
}

export interface PtyProcessLike {
  onData(listener: (data: string) => void): Disposable;
  onExit(listener: (event: PtyExitEvent) => void): Disposable;
  write(data: string): void;
}

export interface ClaudeSessionOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export type PtyFactory = (options: ClaudeSessionOptions) => PtyProcessLike;

export function createNodePtyFactory(): PtyFactory {
  return (options) =>
    spawn(options.command, options.args, {
      name: "xterm-color",
      cols: 120,
      rows: 30,
      cwd: options.cwd,
      env: options.env
    });
}

export class ClaudeSession {
  private ptyProcess: PtyProcessLike | null = null;
  private readonly outputListeners = new Set<(chunk: string) => void>();

  constructor(
    private readonly options: ClaudeSessionOptions,
    private readonly createPty: PtyFactory = createNodePtyFactory()
  ) {}

  ensureStarted() {
    if (this.ptyProcess) {
      return;
    }

    this.ptyProcess = this.createPty(this.options);
    this.ptyProcess.onData((chunk) => {
      for (const listener of this.outputListeners) {
        listener(chunk);
      }
    });
    this.ptyProcess.onExit(() => {
      this.ptyProcess = null;
    });
  }

  onOutput(listener: (chunk: string) => void): () => void {
    this.outputListeners.add(listener);
    return () => {
      this.outputListeners.delete(listener);
    };
  }

  write(text: string) {
    this.ensureStarted();
    this.ptyProcess?.write(text);
  }

  sendSignal(signal: "ctrl_c") {
    if (!this.ptyProcess) {
      return;
    }

    if (signal === "ctrl_c") {
      this.ptyProcess.write("\u0003");
    }
  }
}

export function createDefaultClaudeSession(command: string, args: string[]): ClaudeSession {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );

  return new ClaudeSession({
    command,
    args,
    cwd: process.cwd(),
    env
  });
}
