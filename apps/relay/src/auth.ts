import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export interface JwtPayload {
  sub: string;
  email: string;
  type: "access";
  iat: number;
  exp: number;
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function createSignature(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function createPasswordHash(password: string, salt = randomBytes(16).toString("hex")): string {
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const actual = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function hashOpaqueToken(secret: string, pepper = ""): string {
  return createHash("sha256").update(`${pepper}:${secret}`).digest("hex");
}

export function createOpaqueToken(size = 32): string {
  return randomBytes(size).toString("hex");
}

export function createPairingCode(): string {
  let code = "";

  for (let index = 0; index < 8; index += 1) {
    code += randomInt(0, 10).toString();
  }

  return code;
}

export function createAccessToken(
  payload: Pick<JwtPayload, "sub" | "email">,
  secret: string,
  ttlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      type: "access",
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds
    } satisfies JwtPayload)
  );
  const signature = createSignature(`${header}.${body}`, secret);

  return `${header}.${body}.${signature}`;
}

export function verifyAccessToken(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): JwtPayload {
  const [header, body, signature] = token.split(".");

  if (!header || !body || !signature) {
    throw new Error("Malformed access token.");
  }

  const expectedSignature = createSignature(`${header}.${body}`, secret);

  if (signature.length !== expectedSignature.length) {
    throw new Error("Invalid access token signature.");
  }

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error("Invalid access token signature.");
  }

  const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;

  if (payload.type !== "access" || payload.exp <= nowSeconds) {
    throw new Error("Expired access token.");
  }

  return payload;
}

export function extractBearerToken(header?: string): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}
