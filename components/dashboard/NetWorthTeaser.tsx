import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import type { NetWorthTotals } from "@/lib/networth";

type Props = {
  totals: NetWorthTotals | null;
  currency: string;
};

export function NetWorthTeaser({ totals, currency }: Props) {
  const hasData = totals && (totals.totalAssets > 0 || totals.totalLiabilities > 0);

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Net Worth
        </h3>
        <Link
          href="/networth"
          className="flex items-center gap-1 text-xs text-muted hover:text-gold transition-colors"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {!hasData ? (
        <div className="text-center py-6">
          <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-5 h-5 text-gold" />
          </div>
          <p className="text-sm text-muted">
            No accounts yet. Track your assets and liabilities.
          </p>
          <Link
            href="/networth"
            className="text-xs text-gold hover:text-gold-hover mt-2 inline-block transition-colors"
          >
            Add your first account →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <Row
            label="Assets"
            value={formatCurrency(totals.totalAssets, currency)}
            valueClass="text-success"
          />
          <Row
            label="Liabilities"
            value={formatCurrency(totals.totalLiabilities, currency)}
            valueClass="text-danger"
          />
          <div className="border-t border-border pt-3">
            <Row
              label="Net Worth"
              value={formatCurrency(totals.netWorth, currency)}
              valueClass={cn(
                "font-bold text-base",
                totals.netWorth >= 0 ? "text-gold" : "text-danger"
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className={cn("text-sm font-semibold text-foreground", valueClass)}>
        {value}
      </span>
    </div>
  );
}
