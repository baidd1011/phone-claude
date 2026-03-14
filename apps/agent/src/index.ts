import { createDefaultClaudeSession } from "./claudeSession.js";
import { readAgentConfig, writeAgentState } from "./config.js";
import { RelayAgentClient } from "./relayClient.js";

async function main() {
  const config = readAgentConfig();
  const session = createDefaultClaudeSession(config.claudeCommand, config.claudeArgs);
  const client = new RelayAgentClient({
    config,
    session,
    persistState: (state) => {
      writeAgentState(config.stateFilePath, state);
    }
  });

  await client.start();
  console.log(`phone-claude agent connected as ${config.agentName}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
