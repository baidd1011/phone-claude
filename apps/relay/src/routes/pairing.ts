import type { FastifyInstance } from "fastify";

import { createOpaqueToken, createPairingCode, hashOpaqueToken } from "../auth.js";
import type { RelayServerContext } from "../server.js";
import { requireAuthenticatedUser } from "./login.js";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function registerPairingRoutes(app: FastifyInstance, context: RelayServerContext) {
  app.post("/api/pairing-codes", async (request, reply) => {
    const user = requireAuthenticatedUser(request, reply, context);

    if (!user) {
      return;
    }

    const body = (request.body ?? {}) as Record<string, unknown>;
    const agentName = readString(body.agentName) ?? "Main Windows PC";
    const pairingCode = createPairingCode();
    const expiresAt = Date.now() + context.config.pairingCodeTtlSeconds * 1000;

    context.db.createPairingCode(
      user.id,
      agentName,
      hashOpaqueToken(pairingCode, context.config.refreshSecret),
      expiresAt
    );

    return {
      pairingCode,
      agentName,
      expiresAt
    };
  });

  app.post("/api/agents/pair", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const pairingCode = readString(body.pairingCode);
    const requestedAgentName = readString(body.agentName);

    if (!pairingCode) {
      return reply.code(400).send({
        error: "Pairing code is required."
      });
    }

    const pairingRecord = context.db.consumePairingCode(hashOpaqueToken(pairingCode, context.config.refreshSecret));

    if (!pairingRecord) {
      return reply.code(401).send({
        error: "Invalid pairing code."
      });
    }

    const agentToken = createOpaqueToken();
    const agent = context.db.createAgent(
      pairingRecord.user_id,
      requestedAgentName ?? pairingRecord.agent_name,
      hashOpaqueToken(agentToken, context.config.refreshSecret)
    );

    return {
      agentId: agent.id,
      agentToken,
      name: agent.name
    };
  });

  app.get("/api/agents", async (request, reply) => {
    const user = requireAuthenticatedUser(request, reply, context);

    if (!user) {
      return;
    }

    const agents = context.db.listAgentsForUser(user.id).map((agent) => ({
      id: agent.id,
      name: agent.name,
      online: context.hub.isAgentOnline(agent.id),
      lastSeenAt: agent.last_seen_at
    }));

    return {
      agents
    };
  });
}
