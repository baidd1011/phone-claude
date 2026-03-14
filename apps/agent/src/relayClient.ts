import { parseClientMessage } from "@phone-claude/protocol";

import type { AgentConfig, AgentState } from "./config.js";
import type { ClaudeSession } from "./claudeSession.js";

export interface PairingResponse {
  agentId: string;
  agentToken: string;
}

export interface ResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface FetchLike {
  (input: string, init?: RequestInit): Promise<ResponseLike>;
}

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: "open" | "message" | "close" | "error",
    listener: (event: { data?: unknown }) => void
  ): void;
}

export interface WebSocketFactory {
  (url: string): WebSocketLike;
}

export interface RelayAgentClientOptions {
  config: AgentConfig;
  session: ClaudeSession;
  fetchImpl?: FetchLike;
  webSocketFactory?: WebSocketFactory;
  persistState?: (state: AgentState) => void;
}

const SOCKET_OPEN = 1;

export class RelayAgentClient {
  private readonly fetchImpl: FetchLike;
  private readonly webSocketFactory: WebSocketFactory;
  private socket: WebSocketLike | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private agentId?: string;
  private agentToken?: string;
  private readonly persistState: (state: AgentState) => void;

  constructor(private readonly options: RelayAgentClientOptions) {
    this.fetchImpl = options.fetchImpl ?? (fetch as FetchLike);
    this.webSocketFactory = options.webSocketFactory ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
    this.persistState = options.persistState ?? (() => undefined);
    this.agentId = options.config.agentId;
    this.agentToken = options.config.agentToken;

    this.options.session.onOutput((chunk) => {
      this.sendToRelay({
        type: "pty.output",
        payload: {
          agentId: this.requireAgentId(),
          chunk
        }
      });
    });
  }

  async start() {
    this.stopped = false;
    await this.ensureCredentials();
    this.connect();
  }

  stop() {
    this.stopped = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.socket?.close();
    this.socket = null;
  }

  getCredentials(): AgentState {
    return {
      agentId: this.agentId,
      agentToken: this.agentToken
    };
  }

  private async ensureCredentials() {
    if (this.agentId && this.agentToken) {
      return;
    }

    const pairingCode = this.options.config.pairingCode;

    if (!pairingCode) {
      throw new Error("Missing agent credentials and no pairing code was provided.");
    }

    const response = await this.fetchImpl(`${this.options.config.relayUrl}/api/agents/pair`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        pairingCode,
        agentName: this.options.config.agentName
      })
    });

    if (!response.ok) {
      throw new Error(`Agent pairing failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as PairingResponse;
    this.agentId = payload.agentId;
    this.agentToken = payload.agentToken;
    this.persistState(this.getCredentials());
  }

  private connect() {
    const url = new URL(this.options.config.relayWsUrl);
    url.searchParams.set("client", "agent");
    url.searchParams.set("agentId", this.requireAgentId());
    url.searchParams.set("agentToken", this.requireAgentToken());

    const socket = this.webSocketFactory(url.toString());
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.reconnectAttempts = 0;
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      this.handleMessage(event.data);
    });

    socket.addEventListener("close", () => {
      if (this.socket === socket) {
        this.socket = null;
      }

      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  private handleMessage(raw: string) {
    const message = parseClientMessage(JSON.parse(raw));

    switch (message.type) {
      case "session.ensure":
        this.options.session.ensureStarted();
        break;
      case "pty.input":
        this.options.session.write(message.payload.text);
        break;
      case "pty.signal":
        this.options.session.sendSignal(message.payload.signal);
        break;
      default:
        break;
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) {
      return;
    }

    const delay = Math.min(
      this.options.config.reconnectBaseMs * 2 ** this.reconnectAttempts,
      this.options.config.reconnectMaxMs
    );
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (this.stopped) {
        return;
      }

      this.connect();
    }, delay);
  }

  private sendToRelay(message: unknown) {
    if (!this.socket || this.socket.readyState !== SOCKET_OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private requireAgentId(): string {
    if (!this.agentId) {
      throw new Error("Agent id is not initialized.");
    }

    return this.agentId;
  }

  private requireAgentToken(): string {
    if (!this.agentToken) {
      throw new Error("Agent token is not initialized.");
    }

    return this.agentToken;
  }
}
