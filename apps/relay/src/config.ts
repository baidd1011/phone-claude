import process from "node:process";

export interface RelayConfig {
  adminEmail: string;
  adminPassword: string;
  jwtSecret: string;
  refreshSecret: string;
  dbFilePath: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  pairingCodeTtlSeconds: number;
  host: string;
  port: number;
}

export function readRelayConfig(env: NodeJS.ProcessEnv = process.env): RelayConfig {
  const port = Number.parseInt(env.PHONE_CLAUDE_PORT ?? "8787", 10);

  return {
    adminEmail: env.PHONE_CLAUDE_ADMIN_EMAIL ?? "you@example.com",
    adminPassword: env.PHONE_CLAUDE_ADMIN_PASSWORD ?? "change-me",
    jwtSecret: env.PHONE_CLAUDE_JWT_SECRET ?? "dev-jwt-secret",
    refreshSecret: env.PHONE_CLAUDE_REFRESH_SECRET ?? "dev-refresh-secret",
    dbFilePath: env.PHONE_CLAUDE_DB_FILE ?? ".data/relay.sqlite",
    accessTokenTtlSeconds: Number.parseInt(env.PHONE_CLAUDE_ACCESS_TTL_SECONDS ?? "900", 10),
    refreshTokenTtlSeconds: Number.parseInt(env.PHONE_CLAUDE_REFRESH_TTL_SECONDS ?? `${60 * 60 * 24 * 30}`, 10),
    pairingCodeTtlSeconds: Number.parseInt(env.PHONE_CLAUDE_PAIRING_TTL_SECONDS ?? "600", 10),
    host: env.PHONE_CLAUDE_HOST ?? "0.0.0.0",
    port: Number.isNaN(port) ? 8787 : port
  };
}
