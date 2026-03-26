"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Sheet";
import { BillForm } from "@/components/forms/BillForm";
import { BillCard } from "@/components/bills/BillCard";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { useBillStore, type Bill } from "@/lib/stores/billStore";
import {
  formatCurrency,
  billDaysUntilDue,
  cn,
} from "@/lib/utils";

const BILLS_PUSH_SESSION_KEY = "finosuke-bills-urgent-push";

function monthlyEquivalent(bill: Bill): number {
  switch (bill.frequency) {
    case "monthly":
      return bill.amount;
    case "weekly":
      return (bill.amount * 52) / 12;
    case "yearly":
      return bill.amount / 12;
    default:
      return 0;
  }
}

function normalizeBill(raw: Record<string, unknown>): Bill {
  return {
    ...(raw as unknown as Bill),
    nextDueDate:
      typeof raw.nextDueDate === "string"
        ? raw.nextDueDate
        : new Date(raw.nextDueDate as string).toISOString(),
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date(raw.createdAt as string).toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date(raw.updatedAt as string).toISOString(),
  };
}

export default function BillsPage() {
  const {
    bills,
    isLoading,
    setBills,
    setLoading,
    updateBill,
    removeBill,
  } = useBillStore();

  const [tab, setTab] = useState<"upcoming" | "all">("upcoming");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bills");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to load bills");
        return;
      }
      const list = (data.bills ?? []).map((b: Record<string, unknown>) =>
        normalizeBill(b)
      );
      setBills(list);
    } finally {
      setLoading(false);
    }
  }, [setBills, setLoading]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const filtered = useMemo(() => {
    if (tab === "upcoming") {
      return bills.filter((b) => b.isActive);
    }
    return bills;
  }, [bills, tab]);

  const summary = useMemo(() => {
    const active = bills.filter((b) => b.isActive);
    const estMonthly = active.reduce((sum, b) => sum + monthlyEquivalent(b), 0);

    const dueSoon = active.filter((b) => {
      const d = billDaysUntilDue(b.nextDueDate);
      return d >= 0 && d <= 7;
    });
    const dueSoonTotal = dueSoon.reduce((sum, b) => sum + b.amount, 0);

    const overdueCount = active.filter(
      (b) => billDaysUntilDue(b.nextDueDate) < 0
    ).length;

    return { estMonthly, dueSoonCount: dueSoon.length, dueSoonTotal, overdueCount };
  }, [bills]);

  useEffect(() => {
    if (isLoading || bills.length === 0) return;

    const urgent = bills.filter(
      (b) => b.isActive && billDaysUntilDue(b.nextDueDate) <= 0
    );
    if (urgent.length === 0) return;

    try {
      if (typeof sessionStorage === "undefined") return;
      if (sessionStorage.getItem(BILLS_PUSH_SESSION_KEY)) return;
      sessionStorage.setItem(BILLS_PUSH_SESSION_KEY, "1");
    } catch {
      return;
    }

    const title =
      urgent.length === 1
        ? `Bill due: ${urgent[0].name}`
        : `${urgent.length} bills need attention`;

    const body = urgent
      .slice(0, 4)
      .map((b) => `${b.name} (${formatCurrency(b.amount)})`)
      .join(" · ");

    void fetch("/api/push/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: body.length > 400 ? `${body.slice(0, 397)}…` : body,
        url: `${typeof window !== "undefined" ? window.location.origin : ""}/bills`,
        tag: "finosuke-bills-reminder",
      }),
    });
  }, [bills, isLoading]);

  async function handleMarkPaid(bill: Bill) {
    const res = await fetch(`/api/bills/${bill.id}/mark-paid`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not update bill");
      return;
    }
    updateBill(bill.id, normalizeBill(data as Record<string, unknown>));
    toast.success("Marked paid — next due date updated");
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/bills/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not delete bill");
      return;
    }
    removeBill(id);
    toast.success("Bill removed");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Bills
          </h1>
          <p className="text-sm text-muted mt-1">
            Track due dates and get reminders via push (when enabled).
          </p>
        </div>
        <Sheet
          open={sheetOpen}
          onOpenChange={(v) => {
            setSheetOpen(v);
            if (!v) setEditingBill(null);
          }}
        >
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 bg-gold text-background font-semibold text-sm py-2 px-4 rounded-md hover:bg-gold-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              New bill
            </button>
          </SheetTrigger>
          <SheetContent
            title={editingBill ? "Edit bill" : "New bill"}
            description={
              editingBill
                ? "Update amount, schedule, or category"
                : "Add a recurring or one-time bill"
            }
          >
            <BillForm
              editingBill={editingBill}
              onSuccess={() => {
                setSheetOpen(false);
                setEditingBill(null);
                fetchBills();
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">
            Est. monthly load
          </p>
          <p className="text-lg font-bold text-foreground mt-1 tabular-nums">
            {formatCurrency(summary.estMonthly)}
          </p>
          <p className="text-[11px] text-muted mt-1">Active bills, normalized</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">
            Due in 7 days
          </p>
          <p className="text-lg font-bold text-foreground mt-1 tabular-nums">
            {summary.dueSoonCount > 0
              ? formatCurrency(summary.dueSoonTotal)
              : "—"}
          </p>
          <p className="text-[11px] text-muted mt-1">
            {summary.dueSoonCount} bill
            {summary.dueSoonCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">
            Overdue
          </p>
          <p
            className={cn(
              "text-lg font-bold mt-1 tabular-nums",
              summary.overdueCount > 0 ? "text-danger" : "text-foreground"
            )}
          >
            {summary.overdueCount}
          </p>
          <p className="text-[11px] text-muted mt-1">Active bills past due</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["upcoming", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-pill font-medium transition-colors border",
              tab === t
                ? "bg-gold/15 border-gold/30 text-gold"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            {t === "upcoming" ? "Upcoming" : "All bills"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-4xl mb-4">🔔</p>
          <p className="text-base font-medium text-foreground mb-1">
            {tab === "upcoming" ? "No active bills" : "No bills yet"}
          </p>
          <p className="text-sm text-muted">
            {tab === "upcoming"
              ? "Turn on “Active” on a bill or switch to All bills."
              : "Add your first bill to see it here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              onEdit={() => {
                setEditingBill(bill);
                setSheetOpen(true);
              }}
              onMarkPaid={() => handleMarkPaid(bill)}
              onDelete={() => handleDelete(bill.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
