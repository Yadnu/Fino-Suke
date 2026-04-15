"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import {
  formatCurrency,
  formatDate,
  billDaysUntilDue,
  cn,
} from "@/lib/utils";
import type { Bill } from "@/lib/stores/billStore";

type BillCardProps = {
  bill: Bill;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onMarkPaid: () => Promise<void>;
};

export function BillCard({
  bill,
  onEdit,
  onDelete,
  onMarkPaid,
}: BillCardProps) {
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const days = billDaysUntilDue(bill.nextDueDate);
  const overdue = days < 0;
  const dueToday = days === 0;

  let statusLabel: string;
  if (overdue) {
    statusLabel = `${Math.abs(days)}d overdue`;
  } else if (dueToday) {
    statusLabel = "Due today";
  } else if (days === 1) {
    statusLabel = "Due tomorrow";
  } else {
    statusLabel = `Due in ${days} days`;
  }

  const icon = bill.category?.icon ?? "📄";
  const color = bill.category?.color ?? "#71717a";

  async function handleMarkPaid() {
    setMarking(true);
    try {
      await onMarkPaid();
    } finally {
      setMarking(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 rounded-lg border bg-surface transition-colors",
        overdue
          ? "border-danger/40 bg-danger/[0.06]"
          : dueToday
            ? "border-gold/40 bg-gold/[0.06]"
            : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {bill.name}
            </h3>
            {!bill.isActive && (
              <Badge variant="muted" className="text-[10px]">
                Inactive
              </Badge>
            )}
            {overdue && (
              <Badge variant="danger" className="text-[10px]">
                Overdue
              </Badge>
            )}
            {dueToday && !overdue && (
              <Badge variant="gold" className="text-[10px]">
                Today
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">
            {bill.category?.name ?? "Uncategorized"} · Next{" "}
            {formatDate(bill.nextDueDate, "MMM d, yyyy")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">
            {formatCurrency(bill.amount)}
          </p>
          <p
            className={cn(
              "text-xs font-medium mt-0.5",
              overdue ? "text-danger" : dueToday ? "text-gold" : "text-muted"
            )}
          >
            {statusLabel}
          </p>
        </div>
      </div>

      {bill.notes && (
        <p className="text-xs text-muted pl-[52px] -mt-1">{bill.notes}</p>
      )}

      <div className="flex flex-wrap gap-2 pl-[52px] sm:pl-0 sm:justify-end">
        <button
          type="button"
          onClick={handleMarkPaid}
          disabled={marking}
          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-teal/15 text-teal border border-teal/25 hover:bg-teal/25 transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          {marking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Mark paid
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-border text-muted hover:text-foreground hover:bg-accent transition-colors inline-flex items-center gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-border text-muted hover:text-danger hover:border-danger/30 hover:bg-danger/10 transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </DialogTrigger>
          <DialogContent
            title="Delete bill?"
            description="This will remove the bill and its reminders."
          >
            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm rounded-md border border-border text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-md bg-danger/15 border border-danger/30 text-danger hover:bg-danger/25 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
              >
                {deleting ? (
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
}
