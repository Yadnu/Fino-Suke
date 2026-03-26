"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Sheet";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { SkeletonTransactionRow } from "@/components/ui/SkeletonCard";
import {
  useTransactionStore,
  type Transaction,
} from "@/lib/stores/transactionStore";
import {
  formatCurrency,
  formatDate,
  cn,
} from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

const TYPE_LABELS = { expense: "Expense", income: "Income" };

export default function ExpensesPage() {
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
  const [typeFilter, setTypeFilter] = useState<"" | "expense" | "income">("");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (search) params.set("search", search);
      params.set("limit", "50");

      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(
        data.transactions.map((tx: Transaction & { date: string }) => ({
          ...tx,
          date: tx.date,
        })),
        data.total
      );
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search, setTransactions, setLoading]);

  useEffect(() => {
    const timer = setTimeout(fetchTransactions, 300);
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    // Optimistic removal
    removeTransaction(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete transaction");
        fetchTransactions(); // revert
      } else {
        toast.success("Transaction deleted");
      }
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const grouped = groupByDate(transactions);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Expenses
          </h1>
          <p className="text-sm text-muted mt-1">
            {total} transaction{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) setEditingTx(null); }}>
          <SheetTrigger asChild>
            <button className="flex items-center gap-2 bg-gold text-background font-semibold text-sm py-2 px-4 rounded-md hover:bg-gold-hover transition-colors">
              <Plus className="w-4 h-4" />
              Add Transaction
            </button>
          </SheetTrigger>
          <SheetContent
            title={editingTx ? "Edit Transaction" : "New Transaction"}
            description={
              editingTx ? "Update transaction details" : "Log a new income or expense"
            }
          >
            <TransactionForm
              editingTransaction={editingTx}
              onSuccess={() => {
                setSheetOpen(false);
                setEditingTx(null);
                fetchTransactions();
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by notes…"
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

        {/* Type filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-muted" />
          {(["", "expense", "income"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-pill font-medium transition-colors border",
                typeFilter === t
                  ? "bg-gold/15 border-gold/30 text-gold"
                  : "border-border text-muted hover:text-foreground"
              )}
            >
              {t === "" ? "All" : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="bg-surface border border-border rounded-lg p-5 space-y-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonTransactionRow key={i} />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-4xl mb-4">💸</p>
          <p className="text-base font-medium text-foreground mb-1">
            No transactions found
          </p>
          <p className="text-sm text-muted">
            {search || typeFilter
              ? "Try adjusting your filters"
              : "Add your first transaction to get started"}
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
                  const icon = tx.category?.icon ?? "📦";
                  const color = tx.category?.color ?? "#71717a";
                  const isExpense = tx.type === "expense";

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 px-4 py-3 group"
                    >
                      {/* Icon */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        {icon}
                      </div>

                      {/* Info */}
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

                      {/* Amount */}
                      <span
                        className={cn(
                          "text-sm font-semibold shrink-0",
                          isExpense ? "text-danger" : "text-success"
                        )}
                      >
                        {isExpense ? "−" : "+"}
                        {formatCurrency(tx.amount)}
                      </span>

                      {/* Actions */}
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
                            title="Delete transaction?"
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
