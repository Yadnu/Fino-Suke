"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  X,
  TrendingUp,
  DollarSign,
  BarChart2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Sheet";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { SkeletonCard, SkeletonTransactionRow } from "@/components/ui/SkeletonCard";
import {
  useTransactionStore,
  type Transaction,
} from "@/lib/stores/transactionStore";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

type TrendPoint = {
  key: string;
  label: string;
  income: number;
  expenses: number;
};

type TopSource = {
  categoryId: string | null;
  category: { id: string; name: string; icon: string; color: string } | null;
  amount: number;
};

type IncomeTrendData = {
  trend: TrendPoint[];
  currentMonth: { key: string; totalIncome: number; totalExpenses: number };
  avgIncome: number;
  topSources: TopSource[];
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-card text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted">
          {p.name}:{" "}
          <span className="text-foreground font-medium">
            {formatCurrency(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function IncomePage() {
  const {
    transactions,
    total,
    isLoading,
    setTransactions,
    removeTransaction,
    setLoading,
  } = useTransactionStore();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [trendData, setTrendData] = useState<IncomeTrendData | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: "income", limit: "50" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.transactions ?? [], data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, setTransactions, setLoading]);

  useEffect(() => {
    const timer = setTimeout(fetchTransactions, 300);
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  useEffect(() => {
    setTrendLoading(true);
    fetch("/api/analytics/income-trend")
      .then((r) => r.json())
      .then((data) => setTrendData(data))
      .finally(() => setTrendLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    removeTransaction(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete income entry");
        fetchTransactions();
      } else {
        toast.success("Income entry deleted");
      }
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const grouped = groupByDate(transactions);

  const currentIncome = trendData?.currentMonth.totalIncome ?? 0;
  const avgIncome = trendData?.avgIncome ?? 0;
  const topSource = trendData?.topSources?.[0];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Income
          </h1>
          <p className="text-sm text-muted mt-1">
            {total} income entr{total !== 1 ? "ies" : "y"} total
          </p>
        </div>
        <Sheet
          open={sheetOpen}
          onOpenChange={(v) => {
            setSheetOpen(v);
            if (!v) setEditingTx(null);
          }}
        >
          <SheetTrigger asChild>
            <button className="flex items-center gap-2 bg-gold text-background font-semibold text-sm py-2 px-4 rounded-md hover:bg-gold-hover transition-colors">
              <Plus className="w-4 h-4" />
              Add Income
            </button>
          </SheetTrigger>
          <SheetContent
            title={editingTx ? "Edit Income" : "New Income"}
            description={
              editingTx
                ? "Update income details"
                : "Log a new income entry"
            }
          >
            <TransactionForm
              editingTransaction={
                editingTx ?? { type: "income" } as Parameters<typeof TransactionForm>[0]["editingTransaction"]
              }
              onSuccess={() => {
                setSheetOpen(false);
                setEditingTx(null);
                fetchTransactions();
                // Refresh trend data
                fetch("/api/analytics/income-trend")
                  .then((r) => r.json())
                  .then(setTrendData);
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Summary cards */}
      {trendLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-lg p-4 card-hover">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-muted font-medium">This Month</p>
              <div className="w-7 h-7 rounded-md bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
              </div>
            </div>
            <p className="font-display text-xl font-bold text-foreground">
              {formatCurrency(currentIncome)}
            </p>
            <p className="text-xs text-muted mt-1.5">total income</p>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4 card-hover">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-muted font-medium">Monthly Average</p>
              <div className="w-7 h-7 rounded-md bg-gold/10 flex items-center justify-center">
                <BarChart2 className="w-3.5 h-3.5 text-gold" />
              </div>
            </div>
            <p className="font-display text-xl font-bold text-foreground">
              {formatCurrency(avgIncome)}
            </p>
            <p className="text-xs text-muted mt-1.5">over last 6 months</p>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4 card-hover">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-muted font-medium">Top Source</p>
              <div className="w-7 h-7 rounded-md bg-teal/10 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-teal" />
              </div>
            </div>
            {topSource ? (
              <>
                <p className="font-display text-xl font-bold text-foreground">
                  {formatCurrency(topSource.amount)}
                </p>
                <p className="text-xs text-muted mt-1.5 truncate">
                  {topSource.category?.icon ?? "📦"}{" "}
                  {topSource.category?.name ?? "Uncategorized"}
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-xl font-bold text-muted">—</p>
                <p className="text-xs text-muted mt-1.5">no data yet</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 6-month trend chart */}
      {!trendLoading && trendData && trendData.trend.some((t) => t.income > 0) && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="font-display text-base font-semibold text-foreground mb-4">
            6-Month Income Trend
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendData.trend}
                margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
                barSize={24}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#2a2a32"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                  }
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#2a2a32" }} />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="#4ade80"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search income entries…"
          className="input-field pl-9 pr-8"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <div className="bg-surface border border-border rounded-lg p-5 space-y-0">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonTransactionRow key={i} />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-4xl mb-4">💰</p>
          <p className="text-base font-medium text-foreground mb-1">
            No income entries found
          </p>
          <p className="text-sm text-muted">
            {search
              ? "Try adjusting your search"
              : "Add your first income entry to start tracking"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, items }) => (
            <div key={label}>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 px-1">
                {label}
              </h3>
              <div className="bg-surface border border-border rounded-lg divide-y divide-border">
                {items.map((tx) => {
                  const icon = tx.category?.icon ?? "💰";
                  const color = tx.category?.color ?? "#4ade80";

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 px-4 py-3 group"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        {icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {tx.category?.name ?? "Uncategorized"}
                          </p>
                          {tx.isRecurring && (
                            <Badge variant="teal">Recurring</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          {formatDate(tx.date, "MMM d, yyyy")}
                          {tx.notes && ` · ${tx.notes}`}
                        </p>
                      </div>

                      <span className="text-sm font-semibold text-success shrink-0">
                        +{formatCurrency(tx.amount)}
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => {
                            setEditingTx(tx);
                            setSheetOpen(true);
                          }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <Dialog
                          open={confirmDeleteId === tx.id}
                          onOpenChange={(v) =>
                            setConfirmDeleteId(v ? tx.id : null)
                          }
                        >
                          <DialogTrigger asChild>
                            <button className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </DialogTrigger>
                          <DialogContent
                            title="Delete income entry?"
                            description="This action cannot be undone."
                          >
                            <div className="flex gap-3 justify-end mt-2">
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-4 py-2 text-sm rounded-md border border-border text-muted hover:text-foreground transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDelete(tx.id)}
                                disabled={deletingId === tx.id}
                                className="px-4 py-2 text-sm rounded-md bg-danger/15 border border-danger/30 text-danger hover:bg-danger/25 transition-colors disabled:opacity-60 flex items-center gap-2"
                              >
                                {deletingId === tx.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : null}
                                Delete
                              </button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDate(transactions: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  const now = new Date();
  const today = formatDate(now, "yyyy-MM-dd");
  const yesterday = formatDate(
    new Date(now.getTime() - 86400000),
    "yyyy-MM-dd"
  );

  for (const tx of transactions) {
    const d = tx.date.slice(0, 10);
    let label: string;
    if (d === today) label = "Today";
    else if (d === yesterday) label = "Yesterday";
    else label = formatDate(d, "MMMM d, yyyy");
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}
