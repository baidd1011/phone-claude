import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    private host: HTMLElement | null = null;

    open(host: HTMLElement) {
      this.host = host;
    }

    write(chunk: string) {
      if (this.host) {
        this.host.textContent = `${this.host.textContent ?? ""}${chunk}`;
      }
    }

    dispose() {
      this.host = null;
    }
  }
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
