import { describe, it, expect } from "vitest";
import { parseAIResponse, truncateHistory } from "@/lib/ai";
import type { ChatHistoryItem } from "@/lib/validations";

// ── parseAIResponse ───────────────────────────────────────────────────────────

describe("parseAIResponse", () => {
  it("should parse a valid plain answer", () => {
    const raw = JSON.stringify({ type: "answer", content: "You spent $450." });
    const result = parseAIResponse(raw);
    expect(result).toEqual({ type: "answer", content: "You spent $450." });
  });

  it("should parse a valid action proposal", () => {
    const raw = JSON.stringify({
      type: "action",
      summary: "Create a $200 budget",
      proposedAction: { type: "create_budget", args: { amount: 200 } },
    });
    const result = parseAIResponse(raw);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.summary).toBe("Create a $200 budget");
      expect(result.proposedAction.type).toBe("create_budget");
    }
  });

  it("should fall back to plain answer when JSON is invalid", () => {
    const result = parseAIResponse("not valid json{{{{");
    expect(result.type).toBe("answer");
    expect((result as { type: "answer"; content: string }).content).toBe("not valid json{{{{");
  });

  it("should fall back to plain answer when type is unknown", () => {
    const raw = JSON.stringify({ type: "unknown_type", foo: "bar" });
    const result = parseAIResponse(raw);
    expect(result.type).toBe("answer");
  });

  it("should fall back using raw string when parsed object has no content field", () => {
    const raw = JSON.stringify({ something: "else" });
    const result = parseAIResponse(raw);
    expect(result.type).toBe("answer");
  });

  it("should treat action with missing proposedAction.args gracefully", () => {
    const raw = JSON.stringify({
      type: "action",
      summary: "do something",
      proposedAction: { type: "create_budget", args: null },
    });
    // proposedAction.args is null — should fall back to answer
    const result = parseAIResponse(raw);
    // args must be an object — null causes the type guard to fail
    expect(result.type).toBe("answer");
  });

  it("should return answer type when content is a string even with extra fields", () => {
    const raw = JSON.stringify({ type: "other", content: "Some answer" });
    const result = parseAIResponse(raw);
    expect(result.type).toBe("answer");
    expect((result as { type: "answer"; content: string }).content).toBe("Some answer");
  });
});

// ── truncateHistory ───────────────────────────────────────────────────────────

describe("truncateHistory", () => {
  const makeHistory = (n: number): ChatHistoryItem[] =>
    Array.from({ length: n }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message ${i}`,
    }));

  it("should return the full history when it is within maxTurns", () => {
    const history = makeHistory(10); // 5 turns
    const result = truncateHistory(history, 6);
    expect(result).toHaveLength(10);
  });

  it("should trim to the last maxTurns * 2 messages", () => {
    const history = makeHistory(20); // 10 turns
    const result = truncateHistory(history, 6); // keep last 6 turns = 12 messages
    expect(result).toHaveLength(12);
    expect(result[0].content).toBe("message 8");
    expect(result[result.length - 1].content).toBe("message 19");
  });

  it("should return an empty array when given empty history", () => {
    expect(truncateHistory([], 6)).toHaveLength(0);
  });

  it("should handle exactly maxTurns * 2 messages without trimming", () => {
    const history = makeHistory(12); // exactly 6 turns
    expect(truncateHistory(history, 6)).toHaveLength(12);
  });

  it("should trim when history exceeds maxTurns * 2 by one", () => {
    const history = makeHistory(13); // 6 turns + 1 extra
    const result = truncateHistory(history, 6);
    expect(result).toHaveLength(12);
  });

  it("should default to 6 turns when maxTurns is not provided", () => {
    const history = makeHistory(20);
    const result = truncateHistory(history);
    expect(result).toHaveLength(12);
  });
});
