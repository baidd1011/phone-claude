import { describe, expect, it } from "vitest";

import { readAgentConfig } from "./config.js";

describe("readAgentConfig", () => {
  it("derives the websocket path from the relay url", () => {
    const config = readAgentConfig({
      PHONE_CLAUDE_RELAY_URL: "https://relay.example.com"
    });

    expect(config.relayWsUrl).toBe("wss://relay.example.com/ws");
  });
});
