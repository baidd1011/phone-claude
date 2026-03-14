import { useEffect, useState } from "react";

import { listAgents, login } from "./lib/api.js";
import { clearSession, readSession, saveSession } from "./lib/session.js";
import type { AgentSummary, AuthSession } from "./lib/types.js";
import { HomePage } from "./pages/HomePage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { TerminalPage } from "./pages/TerminalPage.js";

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!session) {
      setAgents([]);
      return;
    }

    const accessToken = session.accessToken;
    let cancelled = false;

    async function loadAgents() {
      setAgentsLoading(true);
      setError(null);

      try {
        const nextAgents = await listAgents(accessToken);
        if (!cancelled) {
          setAgents(nextAgents);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) {
          setAgentsLoading(false);
        }
      }
    }

    void loadAgents();

    return () => {
      cancelled = true;
    };
  }, [session, reloadTick]);

  if (!session) {
    return (
      <LoginPage
        error={error}
        loading={authLoading}
        onSubmit={async (email, password) => {
          setAuthLoading(true);
          setError(null);

          try {
            const nextSession = await login(email, password);
            saveSession(nextSession);
            setSession(nextSession);
          } catch (loginError) {
            setError(loginError instanceof Error ? loginError.message : String(loginError));
          } finally {
            setAuthLoading(false);
          }
        }}
      />
    );
  }

  if (selectedAgent) {
    return (
      <TerminalPage
        accessToken={session.accessToken}
        agent={selectedAgent}
        onBack={() => setSelectedAgent(null)}
      />
    );
  }

  return (
    <HomePage
      agents={agents}
      email={session.email}
      error={error}
      loading={agentsLoading}
      onLogout={() => {
        clearSession();
        setSelectedAgent(null);
        setSession(null);
        setError(null);
      }}
      onOpenAgent={(agent) => setSelectedAgent(agent)}
      onReload={() => setReloadTick((current) => current + 1)}
    />
  );
}
