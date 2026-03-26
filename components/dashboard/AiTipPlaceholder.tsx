import Link from "next/link";
import { Sparkles } from "lucide-react";

const TIPS = [
  "Track every expense this week to build awareness of your spending patterns.",
  "Setting a budget takes 5 minutes and can save you hundreds each month.",
  "The 50/30/20 rule: 50% needs, 30% wants, 20% savings.",
  "Review your subscriptions — the average person pays for 3 they forgot about.",
];

export function AiTipPlaceholder() {
  const tip = TIPS[new Date().getDay() % TIPS.length];

  return (
    <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
      {/* Subtle gradient */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-teal/5 rounded-full -translate-y-6 translate-x-6 pointer-events-none" />

      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-teal/15 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-teal" />
        </div>
        <span className="text-xs font-semibold text-teal uppercase tracking-wide">
          Tip of the Day
        </span>
      </div>

      <p className="text-sm text-foreground leading-relaxed relative">{tip}</p>

      <Link
        href="/ai-assistant"
        className="text-xs text-teal hover:text-teal-hover mt-3 inline-block transition-colors"
      >
        Ask AI for personalized advice →
      </Link>
    </div>
  );
}
