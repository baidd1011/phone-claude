import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  created_at: number;
}

export interface PairingCodeRecord {
  id: string;
  user_id: string;
  code_hash: string;
  agent_name: string;
  expires_at: number;
  created_at: number;
  used_at: number | null;
}

export interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  created_at: number;
  last_seen_at: number | null;
}

export interface RelayDatabaseOptions {
  filePath: string;
  adminEmail: string;
  adminPasswordHash: string;
  now?: () => number;
}

function mapNullableRecord<T>(value: T | undefined): T | null {
  return value ?? null;
}

export class RelayDatabase {
  readonly db: DatabaseSync;
  readonly now: () => number;

  constructor(options: RelayDatabaseOptions) {
    if (options.filePath !== ":memory:") {
      mkdirSync(dirname(options.filePath), { recursive: true });
    }

    this.db = new DatabaseSync(options.filePath);
    this.now = options.now ?? (() => Date.now());
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pairing_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code_hash TEXT NOT NULL UNIQUE,
        agent_name TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        used_at INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    this.ensureAdminUser(options.adminEmail, options.adminPasswordHash);
  }

  close() {
    this.db.close();
  }

  ensureAdminUser(email: string, passwordHash: string) {
    const existing = this.getUserByEmail(email);

    if (existing) {
      this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, existing.id);
      return;
    }

    this.db
      .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), email, passwordHash, this.now());
  }

  getUserByEmail(email: string): UserRecord | null {
    return mapNullableRecord(this.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRecord | undefined);
  }

  getUserById(id: string): UserRecord | null {
    return mapNullableRecord(this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRecord | undefined);
  }

  createRefreshToken(userId: string, tokenHash: string, expiresAt: number): RefreshTokenRecord {
    const record: RefreshTokenRecord = {
      id: randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: this.now()
    };

    this.db
      .prepare(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(record.id, record.user_id, record.token_hash, record.expires_at, record.created_at);

    return record;
  }

  getRefreshTokenByHash(tokenHash: string): RefreshTokenRecord | null {
    return mapNullableRecord(
      this.db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?").get(tokenHash) as RefreshTokenRecord | undefined
    );
  }

  deleteRefreshTokenByHash(tokenHash: string) {
    this.db.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(tokenHash);
  }

  createPairingCode(userId: string, agentName: string, codeHash: string, expiresAt: number): PairingCodeRecord {
    const record: PairingCodeRecord = {
      id: randomUUID(),
      user_id: userId,
      code_hash: codeHash,
      agent_name: agentName,
      expires_at: expiresAt,
      created_at: this.now(),
      used_at: null
    };

    this.db
      .prepare(
        "INSERT INTO pairing_codes (id, user_id, code_hash, agent_name, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?, ?, NULL)"
      )
      .run(record.id, record.user_id, record.code_hash, record.agent_name, record.expires_at, record.created_at);

    return record;
  }

  consumePairingCode(codeHash: string): PairingCodeRecord | null {
    const now = this.now();
    const record = this.db
      .prepare(
        "SELECT * FROM pairing_codes WHERE code_hash = ? AND expires_at > ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1"
      )
      .get(codeHash, now) as PairingCodeRecord | undefined;

    if (!record) {
      return null;
    }

    const result = this.db
      .prepare("UPDATE pairing_codes SET used_at = ? WHERE id = ? AND used_at IS NULL")
      .run(now, record.id);

    if (result.changes === 0) {
      return null;
    }

    return {
      ...record,
      used_at: now
    };
  }

  createAgent(userId: string, name: string, tokenHash: string): AgentRecord {
    const record: AgentRecord = {
      id: randomUUID(),
      user_id: userId,
      name,
      token_hash: tokenHash,
      created_at: this.now(),
      last_seen_at: null
    };

    this.db
      .prepare("INSERT INTO agents (id, user_id, name, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, NULL)")
      .run(record.id, record.user_id, record.name, record.token_hash, record.created_at);

    return record;
  }

  getAgentById(agentId: string): AgentRecord | null {
    return mapNullableRecord(this.db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as AgentRecord | undefined);
  }

  getAgentByToken(agentId: string, tokenHash: string): AgentRecord | null {
    return mapNullableRecord(
      this.db
        .prepare("SELECT * FROM agents WHERE id = ? AND token_hash = ?")
        .get(agentId, tokenHash) as AgentRecord | undefined
    );
  }

  touchAgent(agentId: string) {
    this.db.prepare("UPDATE agents SET last_seen_at = ? WHERE id = ?").run(this.now(), agentId);
  }

  listAgentsForUser(userId: string): AgentRecord[] {
    return this.db.prepare("SELECT * FROM agents WHERE user_id = ? ORDER BY created_at DESC").all(userId) as unknown as AgentRecord[];
  }
}
