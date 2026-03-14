import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  createAccessToken,
  createOpaqueToken,
  extractBearerToken,
  hashOpaqueToken,
  verifyAccessToken,
  verifyPassword
} from "../auth.js";
import type { RelayServerContext } from "../server.js";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({
    error: "Unauthorized"
  });
}

export async function registerLoginRoutes(app: FastifyInstance, context: RelayServerContext) {
  app.post("/api/login", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const email = readString(body.email);
    const password = readString(body.password);

    if (!email || !password) {
      return reply.code(400).send({
        error: "Email and password are required."
      });
    }

    const user = context.db.getUserByEmail(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return unauthorized(reply);
    }

    const accessToken = createAccessToken(
      {
        sub: user.id,
        email: user.email
      },
      context.config.jwtSecret,
      context.config.accessTokenTtlSeconds
    );

    const refreshToken = createOpaqueToken();
    context.db.createRefreshToken(
      user.id,
      hashOpaqueToken(refreshToken, context.config.refreshSecret),
      Date.now() + context.config.refreshTokenTtlSeconds * 1000
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email
      }
    };
  });

  app.post("/api/refresh", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const refreshToken = readString(body.refreshToken);

    if (!refreshToken) {
      return reply.code(400).send({
        error: "Refresh token is required."
      });
    }

    const record = context.db.getRefreshTokenByHash(hashOpaqueToken(refreshToken, context.config.refreshSecret));

    if (!record || record.expires_at <= Date.now()) {
      return unauthorized(reply);
    }

    const user = context.db.getUserById(record.user_id);

    if (!user) {
      return unauthorized(reply);
    }

    const accessToken = createAccessToken(
      {
        sub: user.id,
        email: user.email
      },
      context.config.jwtSecret,
      context.config.accessTokenTtlSeconds
    );

    return {
      accessToken
    };
  });
}

export function requireAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
  context: RelayServerContext
): { id: string; email: string } | null {
  const accessToken = extractBearerToken(request.headers.authorization);

  if (!accessToken) {
    unauthorized(reply);
    return null;
  }

  try {
    const payload = verifyAccessToken(accessToken, context.config.jwtSecret);
    return {
      id: payload.sub,
      email: payload.email
    };
  } catch {
    unauthorized(reply);
    return null;
  }
}
