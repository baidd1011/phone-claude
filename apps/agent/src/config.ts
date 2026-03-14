import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";

export interface AgentConfig {
  relayUrl: string;
  relayWsUrl: string;
  agentName: string;
  agentId?: string;
  agentToken?: string;
  pairingCode?: string;
  stateFilePath: string;
  claudeCommand: string;
  claudeArgs: string[];
  reconnectBaseMs: number;
  reconnectMaxMs: number;
}

export interface AgentState {
  agentId?: string;
  agentToken?: string;
}

function splitArgs(value: string): string[] {
  const trimmed = value.trim();
  return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
}

export function readAgentState(stateFilePath: string): AgentState {
  try {
    return JSON.parse(readFileSync(stateFilePath, "utf8")) as AgentState;
  } catch {
    return {};
  }
}

export function writeAgentState(stateFilePath: string, state: AgentState) {
  mkdirSync(dirname(stateFilePath), { recursive: true });
  writeFileSync(stateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function readAgentConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const stateFilePath = env.PHONE_CLAUDE_AGENT_STATE_FILE ?? ".data/agent.json";
  const state = readAgentState(stateFilePath);
  const relayUrl = env.PHONE_CLAUDE_RELAY_URL ?? "http://127.0.0.1:8787";
  const relayWsUrl =
    env.PHONE_CLAUDE_WS_URL ??
    `${relayUrl.replace(/^http/, "ws").replace(/\/+$/, "")}/ws`;

  return {
    relayUrl,
    relayWsUrl,
    agentName: env.PHONE_CLAUDE_AGENT_NAME ?? "Main Windows PC",
    agentId: env.PHONE_CLAUDE_AGENT_ID ?? state.agentId,
    agentToken: env.PHONE_CLAUDE_AGENT_TOKEN ?? state.agentToken,
    pairingCode: env.PHONE_CLAUDE_PAIRING_CODE,
    stateFilePath,
    claudeCommand: env.PHONE_CLAUDE_CLAUDE_CMD ?? "claude",
    claudeArgs: splitArgs(env.PHONE_CLAUDE_CLAUDE_ARGS ?? ""),
    reconnectBaseMs: Number.parseInt(env.PHONE_CLAUDE_RECONNECT_BASE_MS ?? "1000", 10),
    reconnectMaxMs: Number.parseInt(env.PHONE_CLAUDE_RECONNECT_MAX_MS ?? "10000", 10)
  };
}
