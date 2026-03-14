export interface AuthSession {
  email: string;
  accessToken: string;
  refreshToken?: string | null;
}

export interface AgentSummary {
  id: string;
  name: string;
  online: boolean;
}
