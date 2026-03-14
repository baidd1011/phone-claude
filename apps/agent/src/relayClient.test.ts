import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentConfig } from "./config.js";
import type { ClaudeSession } from "./claudeSession.js";
import { RelayAgentClient, type FetchLike, type ResponseLike, type WebSocketLike } from "./relayClient.js";

class FakeWebSocket implements WebSocketLike {
  static readonly OPEN = 1;

  readonly sent: string[] = [];
  readonly listeners = {
    open: [] as Array<(event: { data?: unknown }) => void>,
    message: [] as Array<(event: { data?: unknown }) => void>,
    close: [] as Array<(event: { data?: unknown }) => void>,
    error: [] as Array<(event: { data?: unknown }) => void>
  };

  readyState = FakeWebSocket.OPEN;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    for (const listener of this.listeners.close) {
      listener({});
    }
  }

  addEventListener(
    type: "open" | "message" | "close" | "error",
    listener: (event: { data?: unknown }) => void
  ): void {
    this.listeners[type].push(listener);
  }

  emit(type: "open" | "message" | "close" | "error", event: { data?: unknown } = {}) {
    for (const listener of this.listeners[type]) {
      listener(event);
    }
  }
}

function createConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    relayUrl: "http://relay.test",
    relayWsUrl: "ws://relay.test/ws",
    agentName: "Desk PC",
    stateFilePath: ".data/agent.json",
    claudeCommand: "claude",
    claudeArgs: [],
    reconnectBaseMs: 10,
    reconnectMaxMs: 100,
    ...overrides
  };
}

function createResponse(payload: unknown, ok = true, status = 200): ResponseLike {
  return {
    ok,
    status,
    async json() {
      return payload;
    }
  };
}

describe("RelayAgentClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("exchanges a pairing code for an agent token", async () => {
    const fetchCalls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      fetchCalls.push({ input, init });
      return createResponse({
        agentId: "agent-1",
        agentToken: "token-1"
      });
    };
    const sockets: FakeWebSocket[] = [];
    const session = {
      ensureStarted: vi.fn(),
      write: vi.fn(),
      sendSignal: vi.fn(),
      onOutput: vi.fn().mockReturnValue(() => undefined)
    } as unknown as ClaudeSession;
    const persisted: Array<{ agentId?: string; agentToken?: string }> = [];
    const client = new RelayAgentClient({
      config: createConfig({ pairingCode: "12345678" }),
      session,
      fetchImpl,
      persistState: (state) => {
        persisted.push(state);
      },
      webSocketFactory: (url) => {
        const socket = new FakeWebSocket(url);
        sockets.push(socket);
        return socket;
      }
    });

    await client.start();

    expect(fetchCalls).toHaveLength(1);
    expect(persisted).toContainEqual({
      agentId: "agent-1",
      agentToken: "token-1"
    });
    expect(sockets[0]?.url).toContain("agentId=agent-1");
  });

  it("reconnects after the websocket closes", async () => {
    const sockets: FakeWebSocket[] = [];
    const session = {
      ensureStarted: vi.fn(),
      write: vi.fn(),
      sendSignal: vi.fn(),
      onOutput: vi.fn().mockReturnValue(() => undefined)
    } as unknown as ClaudeSession;
    const client = new RelayAgentClient({
      config: createConfig({
        agentId: "agent-1",
        agentToken: "token-1"
      }),
      session,
      webSocketFactory: (url) => {
        const socket = new FakeWebSocket(url);
        sockets.push(socket);
        return socket;
      }
    });

    await client.start();
    sockets[0].close();
    await vi.advanceTimersByTimeAsync(10);

    expect(sockets).toHaveLength(2);
  });

  it("starts Claude and forwards output once messages arrive", async () => {
    let outputListener: ((chunk: string) => void) | undefined;
    const session = {
      ensureStarted: vi.fn(),
      write: vi.fn(),
      sendSignal: vi.fn(),
      onOutput: vi.fn().mockImplementation((listener: (chunk: string) => void) => {
        outputListener = listener;
        return () => undefined;
      })
    } as unknown as ClaudeSession;
    const sockets: FakeWebSocket[] = [];
    const client = new RelayAgentClient({
      config: createConfig({
        agentId: "agent-1",
        agentToken: "token-1"
      }),
      session,
      webSocketFactory: (url) => {
        const socket = new FakeWebSocket(url);
        sockets.push(socket);
        return socket;
      }
    });

    await client.start();
    sockets[0].emit("message", {
      data: JSON.stringify({
        type: "session.ensure",
        payload: {
          agentId: "agent-1"
        }
      })
    });
    sockets[0].emit("message", {
      data: JSON.stringify({
        type: "pty.input",
        payload: {
          agentId: "agent-1",
          text: "hello\n"
        }
      })
    });
    outputListener?.("world");

    expect(session.ensureStarted).toHaveBeenCalled();
    expect(session.write).toHaveBeenCalledWith("hello\n");
    expect(sockets[0].sent).toContain(
      JSON.stringify({
        type: "pty.output",
        payload: {
          agentId: "agent-1",
          chunk: "world"
        }
      })
    );
  });
});
