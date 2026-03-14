import process from "node:process";
import { fileURLToPath } from "node:url";

import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";

import { createPasswordHash, extractBearerToken, hashOpaqueToken, verifyAccessToken } from "./auth.js";
import { readRelayConfig, type RelayConfig } from "./config.js";
import { RelayDatabase } from "./db.js";
import { registerLoginRoutes } from "./routes/login.js";
import { registerPairingRoutes } from "./routes/pairing.js";
import { RelayHub } from "./ws.js";

interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "message" | "close", listener: (...args: unknown[]) => void): void;
}

function readSocketMessage(message: unknown): string {
  if (typeof message === "string") {
    return message;
  }

  if (Buffer.isBuffer(message)) {
    return message.toString("utf8");
  }

  return String(message);
}

export interface RelayServerContext {
  config: RelayConfig;
  db: RelayDatabase;
  hub: RelayHub;
}

export interface BuildRelayServerOptions {
  config?: RelayConfig;
  db?: RelayDatabase;
  hub?: RelayHub;
}

export function createRelayContext(config: RelayConfig): RelayServerContext {
  const db =
    new RelayDatabase({
      filePath: config.dbFilePath,
      adminEmail: config.adminEmail,
      adminPasswordHash: createPasswordHash(config.adminPassword)
    });

  const hub = new RelayHub((agentId) => {
    const agent = db.getAgentById(agentId);

    if (!agent) {
      return null;
    }

    return {
      id: agent.id,
      userId: agent.user_id,
      name: agent.name
    };
  });

  return { config, db, hub };
}

export async function buildRelayServer(options: BuildRelayServerOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? readRelayConfig();
  const defaultContext = !options.db || !options.hub ? createRelayContext(config) : null;

  const context: RelayServerContext = {
    config,
    db: options.db ?? defaultContext!.db,
    hub: options.hub ?? defaultContext!.hub
  };

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.decorate("relayContext", context);

  await registerLoginRoutes(app, context);
  await registerPairingRoutes(app, context);

  app.get("/health", async () => ({ ok: true }));

  app.get("/ws", { websocket: true }, (socket, request) => {
    const query = (request.query ?? {}) as Record<string, string | undefined>;
    const clientType = query.client;
    const webSocket = socket as unknown as WebSocketLike;

    if (clientType === "phone") {
      const accessToken = query.accessToken ?? extractBearerToken(request.headers.authorization);

      if (!accessToken) {
        webSocket.close(4401, "Missing access token");
        return;
      }

      try {
        const payload = verifyAccessToken(accessToken, context.config.jwtSecret);
        context.hub.connectPhone(payload.sub, webSocket);

        webSocket.on("message", (message) => {
          context.hub.handlePhoneMessage(payload.sub, webSocket, readSocketMessage(message));
        });

        webSocket.on("close", () => {
          context.hub.disconnectPhone(payload.sub, webSocket);
        });
      } catch {
        webSocket.close(4401, "Invalid access token");
      }

      return;
    }

    if (clientType === "agent") {
      const agentId = query.agentId;
      const agentToken = query.agentToken;

      if (!agentId || !agentToken) {
        webSocket.close(4401, "Missing agent credentials");
        return;
      }

      const agent = context.db.getAgentByToken(agentId, hashOpaqueToken(agentToken, context.config.refreshSecret));

      if (!agent) {
        webSocket.close(4401, "Invalid agent credentials");
        return;
      }

      const ownedAgent = {
        id: agent.id,
        userId: agent.user_id,
        name: agent.name
      };

      context.db.touchAgent(agent.id);
      context.hub.connectAgent(ownedAgent, webSocket);

      webSocket.on("message", (message) => {
        context.hub.handleAgentMessage(ownedAgent, readSocketMessage(message));
      });

      webSocket.on("close", () => {
        context.hub.disconnectAgent(ownedAgent.id);
      });

      return;
    }

    webSocket.close(4400, "Unknown websocket client type");
  });

  app.addHook("onClose", async () => {
    context.db.close();
  });

  return app;
}

async function main() {
  const server = await buildRelayServer();
  await server.listen({
    host: server.relayContext.config.host,
    port: server.relayContext.config.port
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

declare module "fastify" {
  interface FastifyInstance {
    relayContext: RelayServerContext;
  }
}
