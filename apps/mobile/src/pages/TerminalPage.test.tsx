import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TerminalPage } from "./TerminalPage.js";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly OPEN = 1;

  readonly url: string;
  readonly protocols?: string | string[];
  readonly send = vi.fn();
  readyState = MockWebSocket.OPEN;

  private listeners = new Map<string, Array<(event: any) => void>>();

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  close(_code?: number, _reason?: string) {
    this.emit("close", { code: 1000 });
  }

  open() {
    this.emit("open", {});
  }

  message(data: unknown) {
    this.emit("message", { data: JSON.stringify(data) });
  }

  terminate(code = 1006) {
    this.emit("close", { code });
  }

  private emit(type: string, event: any) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("TerminalPage", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends input text over the websocket", async () => {
    render(
      <TerminalPage
        accessToken="token-1"
        agent={{ id: "agent-1", name: "Main PC", online: true }}
        onBack={() => undefined}
      />
    );

    const socket = MockWebSocket.instances[0];
    socket.open();

    expect(socket.url).toContain("/ws?");
    expect(socket.url).toContain("client=phone");
    expect(socket.url).toContain("accessToken=token-1");

    fireEvent.change(screen.getByLabelText(/terminal input/i), {
      target: { value: "status" }
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(socket.send).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({
        type: "session.ensure",
        payload: {
          agentId: "agent-1"
        }
      })
    );
    expect(socket.send).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({
        type: "pty.input",
        payload: {
          agentId: "agent-1",
          text: "status\n"
        }
      })
    );
  });

  it("appends streamed output to the terminal view", async () => {
    render(
      <TerminalPage
        accessToken="token-1"
        agent={{ id: "agent-1", name: "Main PC", online: true }}
        onBack={() => undefined}
      />
    );

    const socket = MockWebSocket.instances[0];
    socket.open();
    socket.message({
      type: "pty.output",
      payload: {
        agentId: "agent-1",
        chunk: "hello from claude"
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/hello from claude/i)).toBeInTheDocument();
    });
  });

  it("sends ctrl+c through the websocket", async () => {
    render(
      <TerminalPage
        accessToken="token-1"
        agent={{ id: "agent-1", name: "Main PC", online: true }}
        onBack={() => undefined}
      />
    );

    const socket = MockWebSocket.instances[0];
    socket.open();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ctrl\+c/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /ctrl\+c/i }));

    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "pty.signal",
        payload: {
          agentId: "agent-1",
          signal: "ctrl_c"
        }
      })
    );
  });

  it("reconnects without clearing the existing stream", async () => {
    render(
      <TerminalPage
        accessToken="token-1"
        agent={{ id: "agent-1", name: "Main PC", online: true }}
        onBack={() => undefined}
      />
    );

    const socket = MockWebSocket.instances[0];
    socket.open();
    socket.message({
      type: "pty.output",
      payload: {
        agentId: "agent-1",
        chunk: "sticky output"
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/sticky output/i)).toBeInTheDocument();
    });

    vi.useFakeTimers();

    act(() => {
      socket.terminate();
    });

    expect(screen.getByText(/reconnecting to the relay/i)).toBeInTheDocument();
    expect(screen.getByText(/sticky output/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_200);
    });

    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
