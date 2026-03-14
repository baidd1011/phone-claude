import { parseClientMessage, parseServerMessage } from "@phone-claude/protocol";

export interface OwnedAgent {
  id: string;
  userId: string;
  name: string;
}

export interface RelaySocketLike {
  send(data: string): void;
}

function encodeMessage(message: unknown): string {
  return JSON.stringify(message);
}

export class RelayHub {
  private readonly phonesByUserId = new Map<string, Set<RelaySocketLike>>();
  private readonly agentsById = new Map<string, { agent: OwnedAgent; socket: RelaySocketLike }>();

  constructor(private readonly getOwnedAgent: (agentId: string) => OwnedAgent | null) {}

  connectPhone(userId: string, socket: RelaySocketLike) {
    const current = this.phonesByUserId.get(userId) ?? new Set<RelaySocketLike>();
    current.add(socket);
    this.phonesByUserId.set(userId, current);
  }

  disconnectPhone(userId: string, socket: RelaySocketLike) {
    const current = this.phonesByUserId.get(userId);

    if (!current) {
      return;
    }

    current.delete(socket);

    if (current.size === 0) {
      this.phonesByUserId.delete(userId);
    }
  }

  connectAgent(agent: OwnedAgent, socket: RelaySocketLike) {
    this.agentsById.set(agent.id, { agent, socket });
    this.broadcastToUser(agent.userId, {
      type: "agent.status",
      payload: {
        agentId: agent.id,
        online: true,
        name: agent.name
      }
    });
  }

  disconnectAgent(agentId: string) {
    const existing = this.agentsById.get(agentId);

    if (!existing) {
      return;
    }

    this.agentsById.delete(agentId);
    this.broadcastToUser(existing.agent.userId, {
      type: "agent.status",
      payload: {
        agentId: existing.agent.id,
        online: false,
        name: existing.agent.name
      }
    });
  }

  isAgentOnline(agentId: string): boolean {
    return this.agentsById.has(agentId);
  }

  handlePhoneMessage(userId: string, socket: RelaySocketLike, raw: string) {
    try {
      const message = parseClientMessage(JSON.parse(raw));
      const ownedAgent = this.getOwnedAgent(message.payload.agentId);

      if (!ownedAgent || ownedAgent.userId !== userId) {
        this.sendError(socket, "agent_forbidden", "The requested agent does not belong to this user.");
        return;
      }

      const onlineAgent = this.agentsById.get(ownedAgent.id);

      if (!onlineAgent) {
        this.sendError(socket, "agent_offline", "The requested agent is offline.");
        return;
      }

      onlineAgent.socket.send(encodeMessage(message));
    } catch (error) {
      this.sendError(socket, "bad_message", error instanceof Error ? error.message : "Invalid message.");
    }
  }

  handleAgentMessage(agent: OwnedAgent, raw: string) {
    const message = parseServerMessage(JSON.parse(raw));

    if (message.type === "pty.output" && message.payload.agentId !== agent.id) {
      throw new Error("Agent attempted to emit output for a different agent id.");
    }

    this.broadcastToUser(agent.userId, message);
  }

  private broadcastToUser(userId: string, message: unknown) {
    const sockets = this.phonesByUserId.get(userId);

    if (!sockets) {
      return;
    }

    const encoded = encodeMessage(message);

    for (const socket of sockets) {
      socket.send(encoded);
    }
  }

  private sendError(socket: RelaySocketLike, code: string, message: string) {
    socket.send(
      encodeMessage({
        type: "error",
        payload: {
          code,
          message
        }
      })
    );
  }
}
