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

describe("login routes", () => {
  it("logs in with the configured admin credential", async () => {
    const app = await createServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: {
        email: testConfig.adminEmail,
        password: testConfig.adminPassword
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        email: testConfig.adminEmail
      }
    });
  });

  it("rejects a bad password", async () => {
    const app = await createServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: {
        email: testConfig.adminEmail,
        password: "wrong"
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("refreshes an access token with a valid refresh token", async () => {
    const app = await createServer();
    const login = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: {
        email: testConfig.adminEmail,
        password: testConfig.adminPassword
      }
    });

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/api/refresh",
      payload: {
        refreshToken: login.json().refreshToken
      }
    });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json().accessToken).toEqual(expect.any(String));
  });
});
