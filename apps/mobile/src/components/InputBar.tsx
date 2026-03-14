import { useState } from "react";

interface InputBarProps {
  disabled: boolean;
  onInterrupt(): void;
  onSend(text: string): void;
}

export function InputBar({ disabled, onInterrupt, onSend }: InputBarProps) {
  const [text, setText] = useState("");

  return (
    <form
      className="input-bar"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = text.trim();

        if (!trimmed) {
          return;
        }

        const next = text.endsWith("\n") ? text : `${text}\n`;
        onSend(next);
        setText("");
      }}
    >
      <textarea
        aria-label="Terminal input"
        disabled={disabled}
        placeholder="Type a Claude prompt..."
        rows={4}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
      />
      <div className="input-bar-actions">
        <button className="button-primary" disabled={disabled} type="submit">
          Send
        </button>
        <button className="button-danger" disabled={disabled} onClick={onInterrupt} type="button">
          Ctrl+C
        </button>
      </div>
    </form>
  );
}
