# Phone Claude Public Remote Design

## Scope

Build a personal-use tool that lets a phone control a Windows-hosted Claude CLI over the public internet.

Confirmed constraints:
- Personal use only
- Public internet access required
- Windows desktop only for the computer-side runtime
- Phone UI can be a web app / PWA
- MVP only needs input and output

Out of scope for MVP:
- Multi-user accounts
- Arbitrary shell execution
- File transfer
- Multi-session collaboration
- Native mobile apps

## Requirements

### Functional

- A Windows desktop agent can keep a persistent outbound connection to a cloud relay.
- A phone PWA can sign in and connect to the same relay from any network.
- The phone can start or reattach to one Claude CLI session.
- The phone can send text input to the session.
- The phone can see streamed output from the session.
- The phone can send a small control set, starting with `Ctrl+C`.

### Non-Functional

- Public internet reachable without opening inbound ports on the Windows machine
- Reasonable safety for single-user remote access
- Reconnect after temporary network loss
- Minimal state and minimal parsing of Claude CLI output
- Simple deployment on one VPS

## High-Level Architecture

```text
Phone PWA
  │ HTTPS / WSS
  ▼
Cloud Relay
  │ outbound WSS from Windows machine
  ▼
Windows Agent
  │ PTY
  ▼
Claude CLI
```

### Component Responsibilities

#### Phone PWA

- Authenticate the user
- Show agent online/offline status
- Render terminal output
- Send input text and control signals
- Reconnect to the current session after network loss

#### Cloud Relay

- Terminate TLS
- Authenticate the phone client
- Pair the Windows agent with the user account
- Maintain websocket connections for the phone and the agent
- Route terminal input and output messages
- Keep only lightweight metadata for session ownership and online state

#### Windows Agent

- Read local config and pairing token
- Maintain a long-lived outbound websocket connection to the relay
- Start Claude CLI inside a PTY on demand
- Write phone input into the PTY
- Stream PTY output back to the relay
- Restart its relay connection after transient failures

## Key Decisions

### ADR-001: Use a relay instead of direct phone-to-PC access

Decision:
- Route all traffic through a VPS-hosted relay.

Why:
- Works behind NAT and dynamic residential IPs
- Avoids exposing a raw inbound port on the Windows PC
- Keeps authentication and routing logic in one place

Trade-off:
- Adds one always-on server to operate

### ADR-002: Restrict the agent to Claude CLI only

Decision:
- The Windows agent will launch only a configured Claude command.

Why:
- Dramatically reduces risk versus exposing a general shell
- Matches the real product goal

Trade-off:
- Less flexible than a generic remote terminal

### ADR-003: Use a phone PWA instead of a native app

Decision:
- Build the mobile client as a React PWA first.

Why:
- Fastest path to usable mobile access
- Easy to deploy and iterate
- No app store friction

Trade-off:
- Push notifications and some background behavior remain weaker than native

### ADR-004: Keep the session model minimal

Decision:
- MVP supports one active Claude session per user.

Why:
- Simplifies routing, reconnect, and UI
- Fits the stated requirement of input/output only

Trade-off:
- No concurrent multi-session workflow in v1

## Auth and Pairing Flow

### User Login

- The phone logs into the relay with a single-user credential.
- The relay returns a short-lived access token and a refresh token.

### Agent Pairing

- The relay can mint a one-time pairing code while the user is signed in.
- The user copies that code into the Windows agent once.
- The agent exchanges the code for a long-lived agent token.
- Later connections use the agent token only.

This flow avoids embedding the user password into the Windows agent.

## Runtime Flow

1. The Windows agent boots and opens an outbound websocket to the relay.
2. The phone opens the PWA and logs in to the relay.
3. The phone requests `session.ensure`.
4. If Claude is not running, the agent starts it inside a PTY.
5. The phone sends `pty.input` messages.
6. The agent writes them to the PTY.
7. PTY output is streamed back as `pty.output`.
8. If the phone disconnects, the session may remain alive for later reattach.

## Message Model

HTTP endpoints:
- `POST /api/login`
- `POST /api/refresh`
- `POST /api/pairing-codes`
- `GET /api/agents`

WebSocket events:
- `session.ensure`
- `pty.input`
- `pty.output`
- `pty.signal`
- `agent.status`
- `error`

## Security Baseline

- TLS everywhere
- No direct inbound connectivity to the Windows machine
- Agent restricted to a configured Claude executable and arguments
- Single-user auth plus separate agent token
- Short-lived access tokens for the phone client
- Basic rate limiting on login and websocket handshake
- Server-side ownership checks on every routed message

Deferred for post-MVP:
- End-to-end encryption of terminal payloads
- Hardware-backed secrets
- Multiple user identities

## Deployment

### Relay

- One VPS
- One domain name
- Caddy or Nginx for TLS termination
- Relay process plus SQLite database

### Agent

- Windows background process
- Stored config file with relay URL and agent token
- Optional Task Scheduler entry for auto-start

## Main Risks

### Windows PTY behavior

`node-pty` and Claude CLI behavior on Windows must be validated early. This is the main technical risk and should be derisked before building the full relay and UI.

### Mobile input ergonomics

Soft keyboard input is less reliable when bound directly to terminal widgets. The UI should use a dedicated input bar and treat terminal rendering as output-first.

### Broken relay connections

The agent and phone both need reconnection handling. The product should not require a manual restart after brief network loss.

## MVP Acceptance Criteria

- From a phone on a different network, the user can open the PWA over HTTPS.
- The user can log in and see the Windows agent online.
- The user can start or reattach to a Claude session.
- The user can send text input and observe streamed output in near real time.
- The user can interrupt with `Ctrl+C`.
- No inbound port needs to be opened on the Windows machine.

