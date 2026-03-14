import { describe, expect, it } from "vitest";

import { ClaudeSession, type ClaudeSessionOptions, type Disposable, type PtyFactory, type PtyProcessLike } from "./claudeSession.js";

class FakePty implements PtyProcessLike {
  readonly writes: string[] = [];
  private readonly dataListeners = new Set<(data: string) => void>();
  private readonly exitListeners = new Set<(event: { exitCode: number }) => void>();

  onData(listener: (data: string) => void): Disposable {
    this.dataListeners.add(listener);
    return {
      dispose: () => {
        this.dataListeners.delete(listener);
      }
    };
  }

  onExit(listener: (event: { exitCode: number }) => void): Disposable {
    this.exitListeners.add(listener);
    return {
      dispose: () => {
        this.exitListeners.delete(listener);
      }
    };
  }

  write(data: string): void {
    this.writes.push(data);
  }

  emitData(data: string) {
    for (const listener of this.dataListeners) {
      listener(data);
    }
  }

  emitExit(exitCode: number) {
    for (const listener of this.exitListeners) {
      listener({ exitCode });
    }
  }
}

describe("ClaudeSession", () => {
  it("starts the PTY on first ensureStarted call", () => {
    let starts = 0;
    const fakePty = new FakePty();
    const createPty: PtyFactory = (_options: ClaudeSessionOptions) => {
      starts += 1;
      return fakePty;
    };
    const session = new ClaudeSession({ command: "claude", args: [] }, createPty);

    session.ensureStarted();
    session.ensureStarted();

    expect(starts).toBe(1);
  });

  it("forwards input into the PTY", () => {
    const fakePty = new FakePty();
    const session = new ClaudeSession({ command: "claude", args: [] }, () => fakePty);

    session.write("hello\n");

    expect(fakePty.writes).toContain("hello\n");
  });

  it("emits output chunks to listeners", () => {
    const fakePty = new FakePty();
    const session = new ClaudeSession({ command: "claude", args: [] }, () => fakePty);
    const output: string[] = [];

    session.onOutput((chunk) => {
      output.push(chunk);
    });
    session.ensureStarted();
    fakePty.emitData("hello");

    expect(output).toEqual(["hello"]);
  });
});
