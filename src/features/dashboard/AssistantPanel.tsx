"use client";

import { useState, useRef, useEffect } from "react";
import type { Plan } from "@/lib/validation";

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
}

interface AssistantPanelProps {
  plan?: Plan;
}

let _msgCounter = 0;
function createMessageId(): string {
  _msgCounter += 1;
  return `msg_${Date.now()}_${_msgCounter}`;
}

export function AssistantPanel({ plan }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial_welcome_msg",
      role: "model",
      text: "Hello! I'm Jashn, your event planning assistant. I can help you with budgets, vendors, timelines, and creative ideas for your event. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setError(null);
    const userMsg: Message = { id: createMessageId(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan?.id ?? "no-plan",
          message: text,
          history: messages.slice(-10).map((m) => ({ role: m.role, text: m.text })),
          currentPlan: plan,
        }),
      });
      const data: unknown = await res.json();
      const reply =
        data && typeof data === "object" && "reply" in data && typeof data.reply === "string"
          ? data.reply
          : "Sorry, I couldn't generate a response. Please try again.";

      setMessages((prev) => [...prev, { id: createMessageId(), role: "model", text: reply }]);
    } catch {
      setError("Network error. Please try again.");
      setMessages((prev) => prev.slice(0, -1)); // remove last user message
      setInput(text); // restore input
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: 500,
        background: "var(--color-bg-card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--color-border)",
        overflow: "hidden",
      }}
      aria-label="Planning assistant chat"
    >
      {/* Messages */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "0.625rem 0.875rem",
                borderRadius:
                  msg.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                background: msg.role === "user" ? "var(--color-accent)" : "var(--color-bg-subtle)",
                color: msg.role === "user" ? "white" : "var(--color-text)",
                fontSize: "0.9rem",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: "flex" }}>
            <div
              role="status"
              aria-label="Assistant is thinking"
              style={{
                padding: "0.625rem 0.875rem",
                background: "var(--color-bg-subtle)",
                borderRadius: "1rem",
                fontSize: "0.9rem",
                color: "var(--color-text-muted)",
              }}
            >
              <span aria-hidden="true">⏳</span> Thinking...
            </div>
          </div>
        )}

        {error && (
          <div role="alert" style={{ color: "var(--color-danger)", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          padding: "0.75rem",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your event plan..."
          maxLength={500}
          aria-label="Message to assistant"
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "0.625rem 0.75rem",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            background: "var(--color-bg)",
            color: "var(--color-text)",
            fontSize: "0.9rem",
          }}
        />
        <button
          onClick={() => void send()}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          style={{
            padding: "0.625rem 1rem",
            background: "var(--color-accent)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius)",
            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
            fontSize: "0.9rem",
            fontWeight: 600,
            minHeight: 44,
            minWidth: 44,
            opacity: isLoading || !input.trim() ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
