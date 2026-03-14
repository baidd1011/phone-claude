import {
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
  type Signal
} from "@phone-claude/protocol";

export type SocketStatus = "idle" | "connecting" | "live" | "reconnecting" | "closed";

interface TerminalSocketOptions {
  accessToken: string;
  agentId: string;
  onMessage(message: ServerMessage): void;
  onStatus(status: SocketStatus): void;
  onError(message: string): void;
}

function resolveWsUrl(accessToken: string): string {
  const baseUrl =
    import.meta.env.VITE_WS_URL ??
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
  const url = new URL(baseUrl, window.location.href);
  url.searchParams.set("client", "phone");
  url.searchParams.set("accessToken", accessToken);
  return url.toString();
}

export class TerminalSocketClient {
  private readonly options: TerminalSocketOptions;
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private disposed = false;

  constructor(options: TerminalSocketOptions) {
    this.options = options;
  }

  connect(): void {
    if (this.disposed) {
      return;
    }

    this.options.onStatus(this.socket ? "reconnecting" : "connecting");
    const socket = new WebSocket(resolveWsUrl(this.options.accessToken));
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.options.onStatus("live");
      this.send({
        type: "session.ensure",
        payload: {
          agentId: this.options.agentId
        }
      });
    });

    socket.addEventListener("message", (event) => {
      try {
        const parsed = parseServerMessage(JSON.parse(String(event.data)));
        this.options.onMessage(parsed);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.options.onError(message);
      }
    });

    socket.addEventListener("close", () => {
      this.socket = null;

      if (this.disposed) {
        this.options.onStatus("closed");
        return;
      }

      this.options.onStatus("reconnecting");
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 1_200);
    });

    socket.addEventListener("error", () => {
      this.options.onError("WebSocket transport failed.");
    });
  }

  sendInput(text: string): void {
    this.send({
      type: "pty.input",
      payload: {
        agentId: this.options.agentId,
        text
      }
    });
  }

  sendSignal(signal: Signal): void {
    this.send({
      type: "pty.signal",
      payload: {
        agentId: this.options.agentId,
        signal
      }
    });
  }

  dispose(): void {
    this.disposed = true;

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.socket?.close(1000, "dispose");
    this.socket = null;
    this.options.onStatus("closed");
  }

  private send(message: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }
}
