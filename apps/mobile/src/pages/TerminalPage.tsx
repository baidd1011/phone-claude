import { useEffect, useMemo, useState } from "react";
import type { ServerMessage } from "@phone-claude/protocol";

import { TerminalSocketClient, type SocketStatus } from "../lib/socket.js";
import type { AgentSummary } from "../lib/types.js";
import { InputBar } from "../components/InputBar.js";
import { TerminalView } from "../components/TerminalView.js";

interface TerminalPageProps {
  accessToken: string;
  agent: AgentSummary;
  onBack(): void;
}

export function TerminalPage({ accessToken, agent, onBack }: TerminalPageProps) {
  const [chunks, setChunks] = useState<string[]>([]);
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(
    () =>
      new TerminalSocketClient({
        accessToken,
        agentId: agent.id,
        onMessage(message: ServerMessage) {
          if (message.type === "pty.output") {
            setChunks((current) => [...current, message.payload.chunk]);
          }

          if (message.type === "error") {
            setError(message.payload.message);
          }
        },
        onStatus(nextStatus) {
          setStatus(nextStatus);
        },
        onError(message) {
          setError(message);
        }
      }),
    [accessToken, agent.id]
  );

  useEffect(() => {
    client.connect();

    return () => {
      client.dispose();
    };
  }, [client]);

  return (
    <main className="app-shell">
      <section className="card terminal-layout">
        <header className="header-row">
          <div>
            <div className="screen-label">Live Console</div>
            <h1 className="hero-title">{agent.name}</h1>
            <p className="subtle">One agent. One socket. One stream.</p>
          </div>
          <div className="button-row">
            <div className="status-pill" data-status={status}>
              {status}
            </div>
            <button className="button-ghost" onClick={onBack} type="button">
              Back
            </button>
          </div>
        </header>
        {error ? <div className="error-banner">{error}</div> : null}
        {status === "reconnecting" ? (
          <div className="status-banner">Reconnecting to the relay without clearing the stream...</div>
        ) : null}
        <section className="terminal-panel">
          <div className="terminal-toolbar">
            <span className="screen-label">Output stream</span>
            <span className="subtle">{agent.id}</span>
          </div>
          <TerminalView chunks={chunks} />
        </section>
        <InputBar
          disabled={status !== "live"}
          onInterrupt={() => client.sendSignal("ctrl_c")}
          onSend={(text) => client.sendInput(text)}
        />
      </section>
    </main>
  );
}
