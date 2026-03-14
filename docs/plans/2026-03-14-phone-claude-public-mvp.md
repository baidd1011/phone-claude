# Phone Claude Public MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal-use system that lets a phone PWA send input to and view output from a Windows-hosted Claude CLI through a public relay.

**Architecture:** Use a three-part system: a VPS-hosted relay, a Windows desktop agent, and a mobile PWA. The relay handles auth, pairing, and websocket routing; the agent owns the PTY and Claude process; the PWA handles login, input, and terminal output rendering.

**Tech Stack:** TypeScript, Node.js 20, npm workspaces, Fastify, `ws`, SQLite, `node-pty`, React, Vite, `xterm.js`, Vitest, React Testing Library, Caddy

---

### Task 1: Bootstrap the workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `apps/relay/package.json`
- Create: `apps/agent/package.json`
- Create: `apps/mobile/package.json`
- Create: `packages/protocol/package.json`

**Step 1: Write the failing smoke checks**

Create `README.md` with the intended workspace layout and scripts, then add root scripts that currently fail because app files do not exist yet.

**Step 2: Run the root install and script listing**

Run: `npm install`
Expected: workspace installs without path errors

Run: `npm run`
Expected: root scripts list `build`, `test`, and workspace-targeted commands

**Step 3: Add the minimal workspace configuration**

Create npm workspaces for `apps/*` and `packages/*`, plus a shared base TypeScript config.

**Step 4: Verify the workspace is recognized**

Run: `npm query .workspace`
Expected: entries for `apps/relay`, `apps/agent`, `apps/mobile`, and `packages/protocol`

**Step 5: Commit**

```bash
git add package.json tsconfig.base.json .gitignore .env.example README.md apps packages
git commit -m "chore: bootstrap phone-claude workspace"
```

### Task 2: Derisk Windows PTY + Claude CLI

**Files:**
- Create: `apps/agent/src/ptyProbe.ts`
- Create: `apps/agent/src/ptyProbe.test.ts`
- Modify: `apps/agent/package.json`

**Step 1: Write the failing PTY probe test**

Add a test that stubs the PTY adapter and verifies the probe records stdout chunks and exit status.

```ts
it("collects output chunks from a PTY-backed process", async () => {
  const result = await runProbe(fakePtyFactory(["hello", "world"], 0));
  expect(result.output).toContain("hello");
  expect(result.exitCode).toBe(0);
});
```

**Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @phone-claude/agent -- ptyProbe`
Expected: FAIL because `runProbe` does not exist yet

**Step 3: Implement the minimal PTY probe**

Create a small probe that starts the configured command through `node-pty`, captures output, and resolves on exit.

**Step 4: Run the automated test and a manual Windows check**

Run: `npm run test --workspace @phone-claude/agent -- ptyProbe`
Expected: PASS

Run: `npm run probe:claude --workspace @phone-claude/agent`
Expected: Claude CLI starts under PTY and emits visible output on Windows

**Step 5: Commit**

```bash
git add apps/agent/src/ptyProbe.ts apps/agent/src/ptyProbe.test.ts apps/agent/package.json
git commit -m "test: validate claude cli works under windows pty"
```

### Task 3: Define the shared protocol

**Files:**
- Create: `packages/protocol/src/index.ts`
- Create: `packages/protocol/src/index.test.ts`
- Modify: `packages/protocol/package.json`

**Step 1: Write the failing schema tests**

Add tests for parseable websocket messages and invalid payload rejection.

```ts
it("parses a valid pty.input message", () => {
  const parsed = ClientMessageSchema.parse({
    type: "pty.input",
    payload: { text: "hi\n" }
  });
  expect(parsed.type).toBe("pty.input");
});
```

**Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace @phone-claude/protocol`
Expected: FAIL because schemas are missing

**Step 3: Implement minimal shared types and schemas**

Create discriminated unions for:
- `session.ensure`
- `pty.input`
- `pty.output`
- `pty.signal`
- `agent.status`
- `error`

Use `zod` so both relay and clients validate payloads.

**Step 4: Re-run the tests**

Run: `npm run test --workspace @phone-claude/protocol`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/protocol
git commit -m "feat: add shared relay protocol"
```

### Task 4: Build relay auth and pairing HTTP APIs

**Files:**
- Create: `apps/relay/src/config.ts`
- Create: `apps/relay/src/db.ts`
- Create: `apps/relay/src/auth.ts`
- Create: `apps/relay/src/routes/login.ts`
- Create: `apps/relay/src/routes/pairing.ts`
- Create: `apps/relay/src/server.ts`
- Create: `apps/relay/src/routes/login.test.ts`
- Create: `apps/relay/src/routes/pairing.test.ts`

**Step 1: Write the failing HTTP tests**

Cover:
- successful login with the configured admin credential
- login failure with a bad password
- creation of a one-time pairing code after auth
- rejection of unauthenticated pairing requests

**Step 2: Run relay route tests**

Run: `npm run test --workspace @phone-claude/relay -- login pairing`
Expected: FAIL because server and routes are missing

**Step 3: Implement the minimal HTTP surface**

Use SQLite tables for:
- `users`
- `refresh_tokens`
- `pairing_codes`
- `agents`

Support:
- `POST /api/login`
- `POST /api/refresh`
- `POST /api/pairing-codes`
- `GET /api/agents`

Use JWT access tokens and hashed refresh tokens.

**Step 4: Re-run tests**

Run: `npm run test --workspace @phone-claude/relay -- login pairing`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/relay/src
git commit -m "feat: add relay auth and pairing apis"
```

### Task 5: Implement relay websocket routing

**Files:**
- Create: `apps/relay/src/ws.ts`
- Create: `apps/relay/src/ws.test.ts`
- Modify: `apps/relay/src/server.ts`

**Step 1: Write the failing websocket bridge tests**

Add tests that simulate:
- one phone client and one paired agent connecting
- `session.ensure` routed from phone to agent
- `pty.output` routed from agent to phone
- messages from the wrong owner being rejected

**Step 2: Run websocket tests**

Run: `npm run test --workspace @phone-claude/relay -- ws`
Expected: FAIL because websocket bridge code is missing

**Step 3: Implement the bridge**

Requirements:
- identify each websocket as `phone` or `agent`
- verify ownership before routing
- track one active session id per user
- broadcast `agent.status` on connect and disconnect

**Step 4: Re-run websocket tests**

Run: `npm run test --workspace @phone-claude/relay -- ws`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/relay/src/ws.ts apps/relay/src/ws.test.ts apps/relay/src/server.ts
git commit -m "feat: bridge phone and agent websocket traffic"
```

### Task 6: Build the Windows agent runtime

**Files:**
- Create: `apps/agent/src/config.ts`
- Create: `apps/agent/src/relayClient.ts`
- Create: `apps/agent/src/claudeSession.ts`
- Create: `apps/agent/src/index.ts`
- Create: `apps/agent/src/relayClient.test.ts`
- Create: `apps/agent/src/claudeSession.test.ts`

**Step 1: Write the failing agent tests**

Cover:
- exchanging a pairing code for an agent token
- reconnecting to relay after socket close
- starting Claude on first `session.ensure`
- forwarding `pty.input` into the PTY
- emitting `pty.output` back to the relay

**Step 2: Run the agent tests**

Run: `npm run test --workspace @phone-claude/agent`
Expected: FAIL because runtime files do not exist

**Step 3: Implement the minimal agent**

Requirements:
- load config from `.env` or local JSON
- connect outbound to relay over websocket
- keep one live Claude PTY session
- handle `pty.input` and `pty.signal`
- emit `pty.output` and `agent.status`
- auto-reconnect with backoff

**Step 4: Re-run the tests and a manual relay check**

Run: `npm run test --workspace @phone-claude/agent`
Expected: PASS

Run: `npm run dev --workspace @phone-claude/agent`
Expected: agent connects to the relay and reports online status

**Step 5: Commit**

```bash
git add apps/agent/src
git commit -m "feat: add windows relay agent for claude sessions"
```

### Task 7: Build the mobile PWA shell and login flow

**Files:**
- Create: `apps/mobile/index.html`
- Create: `apps/mobile/src/main.tsx`
- Create: `apps/mobile/src/App.tsx`
- Create: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/src/lib/session.ts`
- Create: `apps/mobile/src/pages/LoginPage.tsx`
- Create: `apps/mobile/src/pages/HomePage.tsx`
- Create: `apps/mobile/src/App.test.tsx`

**Step 1: Write the failing UI tests**

Cover:
- login form submission
- token persistence
- online/offline agent state display

**Step 2: Run the mobile tests**

Run: `npm run test --workspace @phone-claude/mobile`
Expected: FAIL because the app shell does not exist

**Step 3: Implement the minimal PWA shell**

Requirements:
- login form
- token storage
- list of paired agents
- button to open the terminal screen for the current agent

**Step 4: Re-run the tests**

Run: `npm run test --workspace @phone-claude/mobile`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat: add mobile pwa login and agent selection"
```

### Task 8: Build the mobile terminal page

**Files:**
- Create: `apps/mobile/src/lib/socket.ts`
- Create: `apps/mobile/src/pages/TerminalPage.tsx`
- Create: `apps/mobile/src/components/TerminalView.tsx`
- Create: `apps/mobile/src/components/InputBar.tsx`
- Create: `apps/mobile/src/pages/TerminalPage.test.tsx`

**Step 1: Write the failing terminal page tests**

Cover:
- sending input text over websocket
- appending streamed output to the terminal view
- sending `Ctrl+C`
- reconnecting the socket without clearing the current view immediately

**Step 2: Run the terminal page tests**

Run: `npm run test --workspace @phone-claude/mobile -- TerminalPage`
Expected: FAIL because websocket and terminal page are missing

**Step 3: Implement the terminal page**

Requirements:
- open websocket after login
- send `session.ensure` on page load
- render output with `xterm.js`
- use a dedicated bottom input bar instead of direct terminal typing
- expose a `Ctrl+C` button

**Step 4: Re-run tests and manual browser check**

Run: `npm run test --workspace @phone-claude/mobile -- TerminalPage`
Expected: PASS

Run: `npm run dev --workspace @phone-claude/mobile`
Expected: mobile browser can log in, send input, and see output from a live agent

**Step 5: Commit**

```bash
git add apps/mobile/src
git commit -m "feat: add mobile terminal streaming ui"
```

### Task 9: Add deployment assets and operational docs

**Files:**
- Create: `ops/caddy/Caddyfile`
- Create: `ops/relay/.env.example`
- Create: `ops/relay/systemd/phone-claude-relay.service`
- Create: `ops/agent/windows/Install-Agent.ps1`
- Modify: `README.md`

**Step 1: Write the failing deployment checklist**

Add a checklist to `README.md` that references files that do not exist yet for:
- VPS bootstrap
- relay env vars
- Caddy TLS config
- Windows agent install and auto-start

**Step 2: Validate the missing assets**

Run: `rg -n "Caddyfile|Install-Agent.ps1|phone-claude-relay.service" README.md`
Expected: README references missing files that still need to be created

**Step 3: Create the operational assets**

Requirements:
- Caddy reverse proxy to relay over HTTPS
- example env for relay secrets
- Linux systemd unit for relay
- PowerShell install script to register the Windows agent as a scheduled task

**Step 4: Re-check the docs**

Run: `rg -n "Caddyfile|Install-Agent.ps1|phone-claude-relay.service" README.md`
Expected: referenced files now exist

**Step 5: Commit**

```bash
git add ops README.md
git commit -m "docs: add deployment assets for relay and windows agent"
```

### Task 10: Run end-to-end verification

**Files:**
- Modify: `README.md`
- Create: `docs/manual-test-checklist.md`

**Step 1: Write the verification checklist**

Add manual checks for:
- login
- pairing
- agent online status
- first session start
- input from phone
- streamed output to phone
- `Ctrl+C`
- reconnect after network interruption

**Step 2: Run all automated tests**

Run: `npm run test --workspaces`
Expected: PASS across protocol, relay, agent, and mobile workspaces

**Step 3: Run the public-path manual test**

Run the relay on the VPS, connect the Windows agent from one network, then log in from the phone on a different network and execute a real Claude prompt.

Expected:
- phone sees the agent online
- session starts without manual local intervention
- prompt input reaches Claude
- output streams back in near real time

**Step 4: Record final setup notes**

Update `README.md` with known limitations:
- single active session
- Windows-only agent
- no arbitrary shell commands

**Step 5: Commit**

```bash
git add README.md docs/manual-test-checklist.md
git commit -m "test: document end-to-end verification for public remote control"
```

