import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  chunks: string[];
}

export function TerminalView({ chunks }: TerminalViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const writtenRef = useRef(0);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const terminal = new Terminal({
      convertEol: true,
      disableStdin: true,
      theme: {
        background: "#070b12",
        foreground: "#f7f3eb",
        cursor: "#f1b273",
        selectionBackground: "rgba(241, 178, 115, 0.25)"
      }
    });

    terminal.open(hostRef.current);
    terminalRef.current = terminal;

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      writtenRef.current = 0;
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;

    if (!terminal) {
      return;
    }

    for (let index = writtenRef.current; index < chunks.length; index += 1) {
      terminal.write(chunks[index]);
    }

    writtenRef.current = chunks.length;
  }, [chunks]);

  return (
    <div className="terminal-view">
      <div ref={hostRef} />
    </div>
  );
}
