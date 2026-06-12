import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthenticatedUser } from "@/lib/auth";
import { buildUserContext } from "@/lib/ai";
import { redis } from "@/lib/redis";

const CACHE_TTL = 6 * 60 * 60; // 6 hours in seconds

function getCacheKey(userId: string): string {
  return `insights:${userId}`;
}

export async function GET(request: Request) {
  let userId: string;
  try {
    const session = await getAuthenticatedUser();
    userId = session.userId;
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const cacheKey = getCacheKey(userId);

  if (!force) {
    try {
      const cached = await redis.get<{ insights: string[]; generatedAt: string }>(cacheKey);
      if (cached) {
        return NextResponse.json({ ...cached, cached: true });
      }
    } catch {
      // Redis unavailable — proceed without cache
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const context = await buildUserContext(userId);

  const contextSummary = JSON.stringify({
    currency: context.currency,
    currentMonth: context.currentMonth,
    monthlyTotals: context.monthlyTotals,
    topExpenseCategories: context.topExpenseCategories,
    activeBudgets: context.activeBudgets,
    savingsGoals: context.savingsGoals,
    activeBills: context.activeBills,
    netWorth: context.netWorth
      ? {
          totalAssets: context.netWorth.totalAssets,
          totalLiabilities: context.netWorth.totalLiabilities,
          netWorth: context.netWorth.netWorth,
        }
      : null,
  });

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: [
          `You are Fino, a concise personal finance analyst.`,
          `Today is ${new Date().toISOString().slice(0, 10)}. Currency: ${context.currency}.`,
          `Respond ONLY with a JSON object: { "insights": ["...", "...", "...", "..."] }.`,
          `Produce exactly 4 short, specific, actionable bullet-point insights about the user's finances.`,
          `Each insight must be 1–2 sentences. Focus on: spending anomalies, budget warnings, goal progress, or savings rate trends.`,
          `Be specific — reference real numbers from the data. Do NOT give generic advice.`,
        ].join("\n"),
      },
      {
        role: "user",
        content: `Here is my financial snapshot:\n${contextSummary}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 400,
    temperature: 0.4,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let insights: string[] = [];
  try {
    const parsed = JSON.parse(raw) as { insights?: unknown };
    if (Array.isArray(parsed.insights)) {
      insights = parsed.insights.filter((i): i is string => typeof i === "string").slice(0, 4);
    }
  } catch {
    // malformed response
  }

  if (insights.length === 0) {
    insights = ["No insights available at the moment. Try refreshing once you have more transaction data."];
  }

  const payload = {
    insights,
    generatedAt: new Date().toISOString(),
  };

  try {
    await redis.set(cacheKey, payload, { ex: CACHE_TTL });
  } catch {
    // Redis unavailable — return result without caching
  }

  return NextResponse.json({ ...payload, cached: false });
}
