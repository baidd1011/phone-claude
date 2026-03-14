# Manual Test Checklist

## Auth

- Log in from the phone PWA with the configured admin email and password
- Verify the relay returns an access token and refresh token

## Pairing

- Generate a pairing code from the authenticated phone client
- Start the Windows agent with that pairing code
- Verify the agent receives and persists an `agentId` and `agentToken`

## Agent Status

- Confirm the phone sees the Windows agent as online after websocket connect
- Confirm the agent is shown as offline after the desktop process exits

## Session Flow

- Open the terminal page from the phone
- Verify `session.ensure` starts or reattaches to the Claude PTY
- Send a prompt from the phone input bar
- Verify Claude output streams back in near real time
- Send `Ctrl+C` and verify the PTY receives the interrupt

## Reconnect

- Temporarily disable network on the phone and re-enable it
- Verify the phone websocket reconnects without clearing existing terminal output immediately
- Temporarily interrupt the relay connection on the Windows machine
- Verify the agent reconnects automatically
