"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightsResponse {
  insights: string[];
  generatedAt: string;
  cached: boolean;
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-3 rounded-full bg-border animate-pulse",
        className
      )}
    />
  );
}

export function AiInsightsCard() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInsights = useCallback(async (force = false) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(false);

    try {
      const res = await fetch(`/api/ai/insights${force ? "?force=true" : ""}`);
      if (!res.ok) throw new Error("Failed to load insights");
      const json = (await res.json()) as InsightsResponse;
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchInsights(false);
  }, [fetchInsights]);

  const generatedLabel = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
      {/* Teal ambient glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-teal/5 rounded-full -translate-y-8 translate-x-8 pointer-events-none" />

      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-teal/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-teal" />
          </div>
          <span className="text-xs font-semibold text-teal uppercase tracking-wide">
            AI Insights
          </span>
        </div>

        <div className="flex items-center gap-3">
          {generatedLabel && !loading && (
            <span className="text-xs text-muted hidden sm:block">
              {data?.cached ? "cached · " : ""}updated {generatedLabel}
            </span>
          )}
          <button
            onClick={() => void fetchInsights(true)}
            disabled={loading || refreshing}
            title="Refresh insights"
            className={cn(
              "text-muted hover:text-teal transition-colors disabled:opacity-40",
              refreshing && "animate-spin"
            )}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-3 py-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-teal/40 mt-1.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <SkeletonLine className={i % 2 === 0 ? "w-full" : "w-4/5"} />
                {i % 3 !== 2 && <SkeletonLine className="w-3/5" />}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-4 text-center space-y-2">
          <p className="text-sm text-muted">
            Could not load insights right now.
          </p>
          <button
            onClick={() => void fetchInsights(false)}
            className="text-xs text-teal hover:text-teal-hover transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <ul className="space-y-3 relative">
          {data?.insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal mt-1.5 shrink-0" />
              <p className="text-sm text-foreground leading-relaxed">{insight}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Link
          href="/ai-assistant"
          className="flex items-center gap-1 text-xs text-teal hover:text-teal-hover transition-colors"
        >
          Ask Fino a question
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
