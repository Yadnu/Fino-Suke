"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Loader2, TrendingUp } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Sheet";
import { AccountCard } from "@/components/networth/AccountCard";
import { NetWorthTrendChart } from "@/components/networth/NetWorthTrendChart";
import { NetWorthAccountForm } from "@/components/forms/NetWorthAccountForm";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import {
  useNetWorthStore,
  type NetWorthAccount,
} from "@/lib/stores/networthStore";
import { formatCurrency, cn } from "@/lib/utils";
import { useUserSettings } from "@/lib/context/UserSettingsContext";
import type { NetWorthHistoryItem, NetWorthTotals } from "@/lib/networth";

export default function NetWorthPage() {
  const { currency, locale } = useUserSettings();
  const { accounts, totals, history, isLoading, setData, removeAccount, setLoading } =
    useNetWorthStore();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<NetWorthAccount | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/networth/summary");
      const summary = await res.json();
      setData(
        summary.accounts ?? [],
        summary.totals ?? { totalAssets: 0, totalLiabilities: 0, netWorth: 0 },
        summary.history ?? []
      );
    } finally {
      setLoading(false);
    }
  }, [setData, setLoading]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    removeAccount(id);
    try {
      const res = await fetch(`/api/networth/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete account");
        fetchSummary();
      } else {
        toast.success("Account removed");
        // Refresh totals after delete
        fetchSummary();
      }
    } finally {
      setDeletingId(null);
    }
  }

  function handleSuccess(account: NetWorthAccount) {
    setSheetOpen(false);
    setEditingAccount(null);
    fetchSummary();
  }

  function openEdit(account: NetWorthAccount) {
    setEditingAccount(account);
    setSheetOpen(true);
  }

  function openAdd() {
    setEditingAccount(null);
    setSheetOpen(true);
  }

  const assetAccounts = accounts.filter((a) => a.type === "asset");
  const liabilityAccounts = accounts.filter((a) => a.type === "liability");
  const isEmpty = !isLoading && accounts.length === 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Net Worth</h1>
          <p className="text-sm text-muted mt-1">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-gold text-background text-sm font-semibold px-4 py-2 rounded-md hover:bg-gold-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </SheetTrigger>
          <SheetContent title={editingAccount ? "Edit Account" : "Add Account"}>
            <NetWorthAccountForm
              editingAccount={editingAccount}
              onSuccess={handleSuccess}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Assets"
          value={formatCurrency(totals.totalAssets, currency, locale)}
          colorClass="text-success"
          loading={isLoading}
        />
        <StatCard
          label="Total Liabilities"
          value={formatCurrency(totals.totalLiabilities, currency, locale)}
          colorClass="text-danger"
          loading={isLoading}
        />
        <StatCard
          label="Net Worth"
          value={formatCurrency(totals.netWorth, currency, locale)}
          colorClass={totals.netWorth >= 0 ? "text-gold" : "text-danger"}
          loading={isLoading}
          highlighted
        />
      </div>

      {/* Trend chart */}
      {!isEmpty && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">12-Month Trend</h2>
          <NetWorthTrendChart history={history} currency={currency} />
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <div className="w-14 h-14 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-7 h-7 text-gold" />
          </div>
          <p className="font-display text-lg font-semibold text-foreground mb-1">
            Track your net worth
          </p>
          <p className="text-sm text-muted max-w-xs mx-auto">
            Add your assets and liabilities to see your financial position and watch it grow over time.
          </p>
          <button
            onClick={openAdd}
            className="mt-5 inline-flex items-center gap-2 bg-gold text-background text-sm font-semibold px-4 py-2 rounded-md hover:bg-gold-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add your first account
          </button>
        </div>
      )}

      {/* Assets + Liabilities columns */}
      {!isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AccountGroup
            title="Assets"
            accounts={assetAccounts}
            currency={currency}
            isLoading={isLoading}
            deletingId={deletingId}
            onEdit={openEdit}
            onDelete={handleDelete}
            emptyText="No assets added yet"
          />
          <AccountGroup
            title="Liabilities"
            accounts={liabilityAccounts}
            currency={currency}
            isLoading={isLoading}
            deletingId={deletingId}
            onEdit={openEdit}
            onDelete={handleDelete}
            emptyText="No liabilities added yet"
          />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  colorClass,
  loading,
  highlighted = false,
}: {
  label: string;
  value: string;
  colorClass: string;
  loading: boolean;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-surface border rounded-lg p-5",
        highlighted ? "border-gold/30" : "border-border"
      )}
    >
      <p className="text-xs text-muted font-medium uppercase tracking-wide mb-1">{label}</p>
      {loading ? (
        <div className="h-7 w-28 bg-accent rounded animate-pulse" />
      ) : (
        <p className={cn("text-2xl font-display font-bold", colorClass)}>{value}</p>
      )}
    </div>
  );
}

function AccountGroup({
  title,
  accounts,
  currency,
  isLoading,
  deletingId,
  onEdit,
  onDelete,
  emptyText,
}: {
  title: string;
  accounts: NetWorthAccount[];
  currency: string;
  isLoading: boolean;
  deletingId: string | null;
  onEdit: (a: NetWorthAccount) => void;
  onDelete: (id: string) => void;
  emptyText: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3">{title}</h2>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className={a.id === deletingId ? "opacity-50 pointer-events-none" : ""}>
              <AccountCard
                account={a}
                currency={currency}
                onEdit={() => onEdit(a)}
                onDelete={() => onDelete(a.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
