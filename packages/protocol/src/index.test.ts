import { describe, expect, it } from "vitest";

import { ClientMessageSchema, ServerMessageSchema } from "./index.js";

describe("ClientMessageSchema", () => {
  it("parses a valid pty.input message", () => {
    const parsed = ClientMessageSchema.parse({
      type: "pty.input",
      payload: {
        agentId: "agent-1",
        text: "hi\n"
      }
    });

    expect(parsed.type).toBe("pty.input");
    if (parsed.type !== "pty.input") {
      throw new Error("Expected pty.input");
    }

    expect(parsed.type).toBe("pty.input");
    expect(parsed.payload.text).toBe("hi\n");
  });

  it("rejects pty.input without text", () => {
    expect(() =>
      ClientMessageSchema.parse({
        type: "pty.input",
        payload: {
          agentId: "agent-1"
        }
      })
    ).toThrow();
  });
});

describe("ServerMessageSchema", () => {
  it("parses agent status messages", () => {
    const parsed = ServerMessageSchema.parse({
      type: "agent.status",
      payload: {
        agentId: "agent-1",
        online: true,
        name: "Main PC"
      }
    });

    expect(parsed.type).toBe("agent.status");
    if (parsed.type !== "agent.status") {
      throw new Error("Expected agent.status");
    }

    expect(parsed.type).toBe("agent.status");
    expect(parsed.payload.online).toBe(true);
  });
});
