import type { AgentSummary, AuthSession } from "./types.js";

function resolveApiUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${baseUrl}${path}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let message = `Request failed with status ${response.status}`;

  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message) {
      message = payload.message;
    }
  } catch {
    // Ignore invalid JSON and keep the generic message.
  }

  throw new Error(message);
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const response = await fetch(resolveApiUrl("/api/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  return await parseJson<AuthSession>(response);
}

interface AgentApiResponse {
  id?: string;
  agentId?: string;
  name?: string;
  online?: boolean;
}

export async function listAgents(accessToken: string): Promise<AgentSummary[]> {
  const response = await fetch(resolveApiUrl("/api/agents"), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await parseJson<AgentApiResponse[] | { agents: AgentApiResponse[] }>(response);
  const rows = Array.isArray(payload) ? payload : payload.agents;

  return rows.map((row) => ({
    id: row.id ?? row.agentId ?? "unknown-agent",
    name: row.name ?? row.id ?? row.agentId ?? "Unnamed agent",
    online: Boolean(row.online)
  }));
}
