import { useState } from "react";

interface LoginPageProps {
  error: string | null;
  loading: boolean;
  onSubmit(email: string, password: string): Promise<void> | void;
}

export function LoginPage({ error, loading, onSubmit }: LoginPageProps) {
  const [email, setEmail] = useState("you@example.com");
  const [password, setPassword] = useState("");

  return (
    <main className="app-shell">
      <section className="card stack">
        <span className="eyebrow">Public Relay Access</span>
        <div>
          <h1 className="hero-title">Claude in your pocket.</h1>
          <p className="copy">
            A stripped-down control surface for one Windows agent, one public relay, and the one
            thing you said you care about: input and output.
          </p>
        </div>
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit(email, password);
          }}
        >
          <div className="field">
            <label htmlFor="email">Relay Email</label>
            <input
              id="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </div>
          {error ? <div className="error-banner">{error}</div> : null}
          <button className="button-primary" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Enter Relay"}
          </button>
        </form>
      </section>
    </main>
  );
}
