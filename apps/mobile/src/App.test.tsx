import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";

const fetchMock = vi.fn();

describe("App", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
  });

  it("submits the login form and lands on the agent list", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            email: "you@example.com",
            accessToken: "token-1"
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "agent-1",
              name: "Main PC",
              online: true
            }
          ]),
          { status: 200 }
        )
      );

    render(<App />);

    fireEvent.change(screen.getByLabelText(/relay email/i), {
      target: { value: "you@example.com" }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter2" }
    });
    fireEvent.click(screen.getByRole("button", { name: /enter relay/i }));

    expect(await screen.findByRole("heading", { name: /choose a machine/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/login",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("restores a saved session from local storage", async () => {
    window.localStorage.setItem(
      "phone-claude.session",
      JSON.stringify({
        email: "you@example.com",
        accessToken: "persisted-token"
      })
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: "agent-1",
            name: "Office Tower",
            online: true
          }
        ]),
        { status: 200 }
      )
    );

    render(<App />);

    expect(await screen.findByText(/signed in as you@example.com/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer persisted-token"
        })
      })
    );
  });

  it("shows online and offline agent states", async () => {
    window.localStorage.setItem(
      "phone-claude.session",
      JSON.stringify({
        email: "you@example.com",
        accessToken: "persisted-token"
      })
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: "agent-1",
            name: "Main PC",
            online: true
          },
          {
            id: "agent-2",
            name: "Travel Rig",
            online: false
          }
        ]),
        { status: 200 }
      )
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/main pc status/i)).toHaveTextContent("Online");
      expect(screen.getByLabelText(/travel rig status/i)).toHaveTextContent("Offline");
    });
  });
});
