# phone-claude

[English](./README.md) | [简体中文](./README.zh-CN.md)

Control a Windows-hosted Claude CLI from your phone over the public internet.

This project is a small personal-use remote control stack:

- `mobile`: a phone-first PWA
- `relay`: an HTTP + WebSocket relay service
- `agent`: a Windows desktop process that owns the Claude CLI PTY
- `protocol`: shared message schemas used by all three

The current implementation is intentionally narrow:

- single-user
- single active Claude session
- Windows agent only
- input + output first
- no arbitrary shell execution

## Architecture

```text
Phone browser / PWA
  -> public URL
  -> Caddy
  -> /api + /ws
  -> Relay
  -> Windows Agent
  -> Claude CLI
```

For public access without a VPS, the simplest working setup is:

```text
Phone
  -> cpolar public URL
  -> Windows machine
    -> Caddy on :8080
    -> Relay on 127.0.0.1:8787
    -> Agent on the same machine
    -> Claude CLI
```

## Repository Layout

```text
apps/
  agent/      Windows agent that starts and controls Claude CLI
  mobile/     PWA used on the phone
  relay/      auth, pairing, and websocket routing
packages/
  protocol/   shared zod schemas and message types
docs/
  plans/      design and implementation notes
  manual-test-checklist.md
ops/
  agent/      Windows startup helpers
  caddy/      reverse proxy configs
  relay/      Linux and Windows relay env examples
```

## Prerequisites

- Node.js 20+
- npm 10+
- Claude CLI installed on the Windows machine and available as `claude`
- PowerShell 7 recommended on Windows
- Caddy installed on the Windows machine
- cpolar installed if you want public access without a VPS

## Install

```powershell
cd E:\Java_Learn\phone-claude
npm install
npm run build --workspaces --if-present
```

## Quick Start: Windows + cpolar

This is the path that has been validated in this workspace.

### 1. Start the relay

Create a relay env file:

```powershell
cd E:\Java_Learn\phone-claude
Copy-Item .\ops\relay\windows\relay.env.example.ps1 .\ops\relay\windows\relay.env.ps1
notepad .\ops\relay\windows\relay.env.ps1
```

Set at least:

- `PHONE_CLAUDE_ADMIN_EMAIL`
- `PHONE_CLAUDE_ADMIN_PASSWORD`
- `PHONE_CLAUDE_JWT_SECRET`
- `PHONE_CLAUDE_REFRESH_SECRET`

Load it and start the relay:

```powershell
cd E:\Java_Learn\phone-claude
. .\ops\relay\windows\relay.env.ps1
npm run start --workspace @phone-claude/relay
```

Health check:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8787/health
```

### 2. Start Caddy

The validated local config is:

- `ops/caddy/Caddyfile.windows-local`

It serves the built PWA on `:8080` and proxies:

- `/api/*` -> relay
- `/ws` -> relay
- `/health` -> relay

Run:

```powershell
cd E:\Java_Learn\phone-claude
caddy run --config .\ops\caddy\Caddyfile.windows-local
```

Check:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8080/health
```

### 3. Expose Caddy with cpolar

Run:

```powershell
cpolar http 8080
```

Use the public `https://...` URL that cpolar prints.

Important:

- the phone uses the cpolar public URL
- the Windows agent should still talk to the local relay at `127.0.0.1`

### 4. Generate a pairing code

From a PowerShell window on the Windows machine:

```powershell
cd E:\Java_Learn\phone-claude

$email = "your relay email"
$password = "your relay password"

$loginBody = @{
  email = $email
  password = $password
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8787/api/login" `
  -ContentType "application/json" `
  -Body $loginBody

$pairBody = @{
  agentName = "Main Windows PC"
} | ConvertTo-Json

$pair = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8787/api/pairing-codes" `
  -Headers @{ Authorization = "Bearer $($login.accessToken)" } `
  -ContentType "application/json" `
  -Body $pairBody

$pair.pairingCode
```

### 5. Start the agent

Create the agent env file:

```powershell
cd E:\Java_Learn\phone-claude
Copy-Item .\ops\agent\windows\agent.env.example.ps1 .\ops\agent\windows\agent.env.ps1
notepad .\ops\agent\windows\agent.env.ps1
```

Use local relay values, not the cpolar public URL:

```powershell
$env:PHONE_CLAUDE_RELAY_URL = "http://127.0.0.1:8787"
$env:PHONE_CLAUDE_WS_URL = "ws://127.0.0.1:8787/ws"
$env:PHONE_CLAUDE_AGENT_NAME = "Main Windows PC"
$env:PHONE_CLAUDE_PAIRING_CODE = "replace-with-the-8-digit-code"
$env:PHONE_CLAUDE_AGENT_STATE_FILE = ".data/agent.json"
$env:PHONE_CLAUDE_CLAUDE_CMD = "claude"
$env:PHONE_CLAUDE_CLAUDE_ARGS = ""
$env:PHONE_CLAUDE_RECONNECT_BASE_MS = "1000"
$env:PHONE_CLAUDE_RECONNECT_MAX_MS = "10000"
```

Start:

```powershell
cd E:\Java_Learn\phone-claude
. .\ops\agent\windows\agent.env.ps1
npm run start --workspace @phone-claude/agent
```

Expected output:

```text
phone-claude agent connected as Main Windows PC
```

After first successful pairing, the agent persists credentials to:

- `apps/agent/.data/agent.json`

At that point you can clear `PHONE_CLAUDE_PAIRING_CODE`.

### 6. Open the phone UI

Open the cpolar public URL on your phone, sign in with the relay email and password, refresh the agent list, open the agent, and start typing.

## Scripts

Root scripts:

- `npm run build`
- `npm run test`
- `npm run dev:relay`
- `npm run dev:agent`
- `npm run dev:mobile`

Workspace scripts:

- relay: `npm run start --workspace @phone-claude/relay`
- agent: `npm run start --workspace @phone-claude/agent`
- mobile build: `npm run build --workspace @phone-claude/mobile`

## Configuration

Generic env example:

- `.env.example`

Windows relay env example:

- `ops/relay/windows/relay.env.example.ps1`

Windows agent env example:

- `ops/agent/windows/agent.env.example.ps1`

Linux/VPS deployment examples:

- `ops/caddy/Caddyfile`
- `ops/relay/.env.example`
- `ops/relay/systemd/phone-claude-relay.service`

## Verification

Automated verification that has been run in this workspace:

```powershell
npm run test --workspaces --if-present
npm run build --workspaces --if-present
```

Manual checks are listed in:

- `docs/manual-test-checklist.md`

## Current Limitations

- single active Claude session
- Windows-only desktop agent
- no native mobile app
- no arbitrary shell access
- no built-in pairing UI in the PWA yet
- mobile production bundle is currently large and should be split later
- relay uses Node's experimental `node:sqlite`

## Security Notes

- this project is intended for personal use
- the agent is restricted to a configured Claude command, not an arbitrary shell
- do not expose the raw relay directly to the internet if you can avoid it
- if you use cpolar or a similar tunnel, protect the relay credentials carefully
- rotate secrets if you have shared screenshots, logs, or config files

## Next Improvements

- add a pairing flow to the mobile UI
- add Windows startup tasks for relay and Caddy, not just the agent
- reduce the mobile bundle size
- improve online/offline status refresh
- add session history or transcript persistence
