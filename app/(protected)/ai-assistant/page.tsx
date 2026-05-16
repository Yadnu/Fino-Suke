"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatHistoryItem, ConfirmedAction } from "@/lib/validations";

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant";

interface PlainMessage {
  id: string;
  role: MessageRole;
  type: "text";
  content: string;
}

interface ActionProposalMessage {
  id: string;
  role: "assistant";
  type: "action_proposal";
  summary: string;
  proposedAction: { type: string; args: Record<string, unknown> };
  status: "pending" | "confirmed" | "rejected";
}

interface ActionResultMessage {
  id: string;
  role: "assistant";
  type: "action_result";
  summary: string;
}

type ChatMessage = PlainMessage | ActionProposalMessage | ActionResultMessage;

// ── Starter prompts ───────────────────────────────────────────────────────────

const STARTERS = [
  "How much did I spend on food this month?",
  "What's my savings rate right now?",
  "Create a $200 dining budget for this month",
  "Which categories am I overspending in?",
  "Add a Netflix bill for $15.99 due on the 15th",
  "How close am I to my savings goals?",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-teal/70 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="flex items-end gap-2 max-w-[80%]">
        <div className="bg-gold/15 border border-gold/25 text-foreground text-sm rounded-2xl rounded-br-sm px-4 py-3 leading-relaxed">
          {content}
        </div>
        <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 mb-0.5">
          <User className="w-3.5 h-3.5 text-muted" />
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ content }: { content: string }) {
  return (
    <div className="flex items-end gap-2 max-w-[80%]">
      <div className="w-7 h-7 rounded-full bg-teal/15 border border-teal/30 flex items-center justify-center shrink-0 mb-0.5">
        <Sparkles className="w-3.5 h-3.5 text-teal" />
      </div>
      <div className="bg-surface border border-border text-foreground text-sm rounded-2xl rounded-bl-sm px-4 py-3 leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function ActionProposalCard({
  message,
  onConfirm,
  onReject,
  isPending,
}: {
  message: ActionProposalMessage;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
}) {
  const isSettled = message.status !== "pending";

  return (
    <div className="flex items-end gap-2 max-w-[85%]">
      <div className="w-7 h-7 rounded-full bg-teal/15 border border-teal/30 flex items-center justify-center shrink-0 mb-0.5">
        <Sparkles className="w-3.5 h-3.5 text-teal" />
      </div>
      <div className="bg-surface border border-teal/25 rounded-2xl rounded-bl-sm overflow-hidden w-full">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertCircle className="w-4 h-4 text-teal shrink-0" />
            <span className="text-xs font-semibold text-teal uppercase tracking-wider">
              Action Required
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{message.summary}</p>
        </div>

        <div className="px-4 py-2.5 bg-background/40">
          <p className="text-xs text-muted font-mono">
            {message.proposedAction.type.replace(/_/g, " ")}
          </p>
          <div className="mt-1 space-y-0.5">
            {Object.entries(message.proposedAction.args)
              .filter(([, v]) => v !== null && v !== undefined && v !== "")
              .slice(0, 5)
              .map(([k, v]) => (
                <p key={k} className="text-xs text-muted">
                  <span className="text-foreground/60">{k}:</span>{" "}
                  <span className="text-foreground">{String(v)}</span>
                </p>
              ))}
          </div>
        </div>

        {!isSettled && (
          <div className="px-4 py-3 flex gap-2">
            <button
              onClick={() => onConfirm(message.id)}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-1.5 bg-teal/10 hover:bg-teal/20 text-teal border border-teal/30 text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Confirm
            </button>
            <button
              onClick={() => onReject(message.id)}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        )}

        {message.status === "confirmed" && (
          <div className="px-4 py-2.5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal" />
            <span className="text-xs text-teal">Confirmed and executed</span>
          </div>
        )}

        {message.status === "rejected" && (
          <div className="px-4 py-2.5 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-muted" />
            <span className="text-xs text-muted">Cancelled</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionResultBubble({ summary }: { summary: string }) {
  return (
    <div className="flex items-end gap-2 max-w-[80%]">
      <div className="w-7 h-7 rounded-full bg-teal/15 border border-teal/30 flex items-center justify-center shrink-0 mb-0.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-teal" />
      </div>
      <div className="bg-teal/10 border border-teal/25 text-foreground text-sm rounded-2xl rounded-bl-sm px-4 py-3 leading-relaxed">
        {summary}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onStarter }: { onStarter: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center mb-5">
        <Sparkles className="w-6 h-6 text-teal" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Meet Fino</h2>
      <p className="text-sm text-muted max-w-xs leading-relaxed mb-7">
        Your personal finance assistant. Ask anything about your money, or let Fino take action.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
        {STARTERS.map((q) => (
          <button
            key={q}
            onClick={() => onStarter(q)}
            className="text-left text-xs text-muted hover:text-foreground bg-surface border border-border hover:border-teal/30 rounded-xl px-3.5 py-2.5 transition-all"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Build conversation history for the API from settled text messages only
  function buildHistory(): ChatHistoryItem[] {
    return messages
      .filter((m): m is PlainMessage => m.type === "text")
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: PlainMessage = {
      id: crypto.randomUUID(),
      role: "user",
      type: "text",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: buildHistory() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to get a response");
        return;
      }

      if (data.type === "answer") {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", type: "text", content: data.content },
        ]);
      } else if (data.type === "action") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            type: "action_proposal",
            summary: data.summary,
            proposedAction: data.proposedAction,
            status: "pending",
          } satisfies ActionProposalMessage,
        ]);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(msgId: string) {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || msg.type !== "action_proposal") return;

    setConfirmingId(msgId);

    const confirmedAction: ConfirmedAction = {
      type: msg.proposedAction.type as ConfirmedAction["type"],
      args: msg.proposedAction.args as never,
      summary: msg.summary,
    };

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Confirmed action",
          history: buildHistory(),
          confirmedAction,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Action failed");
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, status: "confirmed" } : m
        )
      );

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          type: "action_result",
          summary: data.summary,
        } satisfies ActionResultMessage,
      ]);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setConfirmingId(null);
    }
  }

  function handleReject(msgId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, status: "rejected" } : m))
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleReset() {
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal/10 border border-teal/25 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-teal" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Fino AI</h1>
            <p className="text-xs text-muted">Finance assistant</p>
          </div>
        </div>

        {!isEmpty && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-accent transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {isEmpty ? (
          <EmptyState onStarter={(q) => sendMessage(q)} />
        ) : (
          <>
            {messages.map((msg) => {
              if (msg.type === "text") {
                return msg.role === "user" ? (
                  <UserBubble key={msg.id} content={msg.content} />
                ) : (
                  <AssistantBubble key={msg.id} content={msg.content} />
                );
              }

              if (msg.type === "action_proposal") {
                return (
                  <ActionProposalCard
                    key={msg.id}
                    message={msg}
                    onConfirm={handleConfirm}
                    onReject={handleReject}
                    isPending={confirmingId === msg.id}
                  />
                );
              }

              if (msg.type === "action_result") {
                return <ActionResultBubble key={msg.id} summary={msg.summary} />;
              }

              return null;
            })}

            {isLoading && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-teal/15 border border-teal/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-teal" />
                </div>
                <div className="bg-surface border border-border rounded-2xl rounded-bl-sm">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-6 pb-6 pt-3 border-t border-border shrink-0">
        <div
          className={cn(
            "flex items-end gap-2 bg-surface border rounded-2xl px-4 py-3 transition-colors",
            isLoading ? "border-border opacity-70" : "border-border focus-within:border-teal/40"
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask Fino anything about your finances…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted resize-none outline-none leading-relaxed max-h-32 overflow-y-auto"
            style={{ minHeight: "1.5rem" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-xl bg-teal flex items-center justify-center shrink-0 transition-all hover:bg-teal-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-background animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-background" />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-muted/50 mt-2">
          Fino uses your real financial data. Writes only execute after confirmation.
        </p>
      </div>
    </div>
  );
}
