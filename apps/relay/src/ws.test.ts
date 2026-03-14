import { describe, expect, it } from "vitest";

import { RelayHub, type OwnedAgent, type RelaySocketLike } from "./ws.js";

class FakeSocket implements RelaySocketLike {
  readonly sent: unknown[] = [];

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
}

describe("RelayHub", () => {
  it("routes session.ensure from phone to agent", () => {
    const agent: OwnedAgent = {
      id: "agent-1",
      userId: "user-1",
      name: "Desk PC"
    };
    const hub = new RelayHub((agentId) => (agentId === agent.id ? agent : null));
    const phone = new FakeSocket();
    const agentSocket = new FakeSocket();

    hub.connectPhone(agent.userId, phone);
    hub.connectAgent(agent, agentSocket);
    hub.handlePhoneMessage(
      agent.userId,
      phone,
      JSON.stringify({
        type: "session.ensure",
        payload: {
          agentId: agent.id
        }
      })
    );

    expect(agentSocket.sent).toContainEqual({
      type: "session.ensure",
      payload: {
        agentId: agent.id
      }
    });
  });

  it("routes pty.output from agent to phone", () => {
    const agent: OwnedAgent = {
      id: "agent-1",
      userId: "user-1",
      name: "Desk PC"
    };
    const hub = new RelayHub((agentId) => (agentId === agent.id ? agent : null));
    const phone = new FakeSocket();
    const agentSocket = new FakeSocket();

    hub.connectPhone(agent.userId, phone);
    hub.connectAgent(agent, agentSocket);
    hub.handleAgentMessage(
      agent,
      JSON.stringify({
        type: "pty.output",
        payload: {
          agentId: agent.id,
          chunk: "hello"
        }
      })
    );

    expect(phone.sent).toContainEqual({
      type: "pty.output",
      payload: {
        agentId: agent.id,
        chunk: "hello"
      }
    });
  });

  it("rejects messages from the wrong owner", () => {
    const agent: OwnedAgent = {
      id: "agent-1",
      userId: "user-1",
      name: "Desk PC"
    };
    const hub = new RelayHub((agentId) => (agentId === agent.id ? agent : null));
    const phone = new FakeSocket();
    const agentSocket = new FakeSocket();

    hub.connectPhone(agent.userId, phone);
    hub.connectAgent(agent, agentSocket);
    hub.handlePhoneMessage(
      "user-2",
      phone,
      JSON.stringify({
        type: "session.ensure",
        payload: {
          agentId: agent.id
        }
      })
    );

    expect(phone.sent.at(-1)).toMatchObject({
      type: "error",
      payload: {
        code: "agent_forbidden"
      }
    });
    expect(agentSocket.sent).not.toContainEqual({
      type: "session.ensure",
      payload: {
        agentId: agent.id
      }
    });
  });
});
