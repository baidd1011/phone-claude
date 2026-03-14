import type { AgentSummary } from "../lib/types.js";

interface HomePageProps {
  agents: AgentSummary[];
  email: string;
  error: string | null;
  loading: boolean;
  onLogout(): void;
  onOpenAgent(agent: AgentSummary): void;
  onReload(): void;
}

export function HomePage({
  agents,
  email,
  error,
  loading,
  onLogout,
  onOpenAgent,
  onReload
}: HomePageProps) {
  return (
    <main className="app-shell">
      <section className="card home-layout">
        <header className="header-row">
          <div>
            <div className="screen-label">Agent Deck</div>
            <h1 className="hero-title">Choose a machine.</h1>
            <p className="subtle">Signed in as {email}</p>
          </div>
          <div className="button-row">
            <button className="button-ghost" onClick={onReload} type="button">
              Refresh
            </button>
            <button className="button-ghost" onClick={onLogout} type="button">
              Log out
            </button>
          </div>
        </header>
        {error ? <div className="error-banner">{error}</div> : null}
        {loading ? <div className="status-banner">Loading paired agents...</div> : null}
        <div className="agent-grid">
          {agents.length === 0 && !loading ? (
            <div className="status-banner">No paired agents yet.</div>
          ) : null}
          {agents.map((agent) => (
            <article className="agent-card" key={agent.id}>
              <header>
                <div>
                  <div className="screen-label">Windows Agent</div>
                  <h2>{agent.name}</h2>
                </div>
                <div
                  aria-label={`${agent.name} status`}
                  className="status-pill"
                  data-status={agent.online ? "online" : "offline"}
                >
                  {agent.online ? "Online" : "Offline"}
                </div>
              </header>
              <button
                className="agent-button"
                disabled={!agent.online}
                onClick={() => onOpenAgent(agent)}
                type="button"
              >
                {agent.online ? "Open terminal" : "Waiting for relay"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
