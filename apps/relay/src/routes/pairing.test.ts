import { afterEach, describe, expect, it } from "vitest";

import { buildRelayServer } from "../server.js";

const testConfig = {
  adminEmail: "owner@example.com",
  adminPassword: "top-secret",
  jwtSecret: "jwt-secret",
  refreshSecret: "refresh-secret",
  dbFilePath: ":memory:",
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 3600,
  pairingCodeTtlSeconds: 600,
  host: "127.0.0.1",
  port: 0
} as const;

const servers: Array<Awaited<ReturnType<typeof buildRelayServer>>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()!.close();
  }
});

async function createServer() {
  const app = await buildRelayServer({
    config: { ...testConfig }
  });

  servers.push(app);
  return app;
}

async function login(app: Awaited<ReturnType<typeof buildRelayServer>>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: {
      email: testConfig.adminEmail,
      password: testConfig.adminPassword
    }
  });

  return response.json() as { accessToken: string };
}

describe("pairing routes", () => {
  it("creates a one-time pairing code after auth", async () => {
    const app = await createServer();
    const auth = await login(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/pairing-codes",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      },
      payload: {
        agentName: "Desk PC"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      agentName: "Desk PC",
      pairingCode: expect.any(String)
    });
  });

  it("rejects unauthenticated pairing requests", async () => {
    const app = await createServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/pairing-codes",
      payload: {
        agentName: "Desk PC"
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("pairs an agent and lists it for the user", async () => {
    const app = await createServer();
    const auth = await login(app);
    const pairingResponse = await app.inject({
      method: "POST",
      url: "/api/pairing-codes",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      },
      payload: {
        agentName: "Desk PC"
      }
    });

    const pairAgent = await app.inject({
      method: "POST",
      url: "/api/agents/pair",
      payload: {
        pairingCode: pairingResponse.json().pairingCode
      }
    });

    expect(pairAgent.statusCode).toBe(200);
    expect(pairAgent.json()).toMatchObject({
      agentId: expect.any(String),
      agentToken: expect.any(String),
      name: "Desk PC"
    });

    const agentsResponse = await app.inject({
      method: "GET",
      url: "/api/agents",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      }
    });

    expect(agentsResponse.statusCode).toBe(200);
    expect(agentsResponse.json()).toMatchObject({
      agents: [
        {
          name: "Desk PC",
          online: false
        }
      ]
    });
  });
});
