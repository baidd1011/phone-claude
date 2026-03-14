import { describe, expect, it } from "vitest";

import type { Disposable, ProbeCommand, ProbeExitEvent, PtyFactory } from "./ptyProbe.js";
import { runProbe } from "./ptyProbe.js";

function noopDisposable(): Disposable {
  return {
    dispose() {
      return;
    }
  };
}

function fakePtyFactory(chunks: string[], exitCode: number, signal?: number): PtyFactory {
  return (_command: ProbeCommand) => ({
    onData(listener) {
      for (const chunk of chunks) {
        listener(chunk);
      }

      return noopDisposable();
    },
    onExit(listener) {
      queueMicrotask(() => {
        const event: ProbeExitEvent = { exitCode, signal };
        listener(event);
      });

      return noopDisposable();
    }
  });
}

describe("runProbe", () => {
  it("collects output chunks from a PTY-backed process", async () => {
    const result = await runProbe(
      fakePtyFactory(["hello", " ", "world"], 0),
      {
        file: "claude",
        args: ["--version"]
      },
      500
    );

    expect(result.output).toContain("hello world");
    expect(result.exitCode).toBe(0);
  });

  it("fails when the PTY never exits", async () => {
    const neverExitFactory: PtyFactory = () => ({
      onData() {
        return noopDisposable();
      },
      onExit() {
        return noopDisposable();
      }
    });

    await expect(
      runProbe(
        neverExitFactory,
        {
          file: "claude",
          args: ["--version"]
        },
        10
      )
    ).rejects.toThrow(/timed out/i);
  });
});
