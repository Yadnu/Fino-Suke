"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Trash2, Building2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";

type PlaidAccount = {
  id: string;
  accountId: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
};

type PlaidItem = {
  id: string;
  itemId: string;
  institutionId: string | null;
  institutionName: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  accounts: PlaidAccount[];
};

type Props = {
  refreshKey?: number;
};

export function ConnectedAccountsList({ refreshKey }: Props) {
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fetchItems = useCallback(() => {
    setLoading(true);
    fetch("/api/plaid/items")
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => toast.error("Failed to load connected banks"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  async function handleSync(itemId: string) {
    setSyncing(itemId);
    try {
      const res = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Sync failed");
        return;
      }
      toast.success(`Synced ${data.synced} transaction${data.synced !== 1 ? "s" : ""}`);
      fetchItems();
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(null);
    }
  }

  async function handleUnlink(itemId: string) {
    setDeleting(itemId);
    try {
      const res = await fetch(`/api/plaid/items/${itemId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to unlink bank");
        return;
      }
      toast.success("Bank unlinked");
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      toast.error("Failed to unlink bank");
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 skeleton rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 skeleton rounded-md" />
                <div className="h-3 w-48 skeleton rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted py-2">
        No banks connected yet. Click &ldquo;Connect a bank&rdquo; to get started.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isSyncing = syncing === item.id;
        const isDeleting = deleting === item.id;

        return (
          <div
            key={item.id}
            className="bg-surface border border-border rounded-lg p-4 space-y-3"
          >
            {/* Header row */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {item.institutionName ?? "Connected Bank"}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {item.accounts.length} account{item.accounts.length !== 1 ? "s" : ""}
                  {item.lastSyncedAt
                    ? ` · Last synced ${new Date(item.lastSyncedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}`
                    : " · Never synced"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSync(item.id)}
                  disabled={isSyncing || isDeleting}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border text-muted hover:text-foreground hover:bg-accent transition-colors disabled:opacity-60"
                >
                  {isSyncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {isSyncing ? "Syncing…" : "Sync now"}
                </button>

                <Dialog
                  open={confirmId === item.id}
                  onOpenChange={(open) => setConfirmId(open ? item.id : null)}
                >
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      disabled={isSyncing || isDeleting}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border text-muted hover:text-danger hover:border-danger/30 hover:bg-danger/10 transition-colors disabled:opacity-60"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Unlink
                    </button>
                  </DialogTrigger>
                  <DialogContent
                    title="Unlink bank?"
                    description={`This will disconnect ${item.institutionName ?? "this bank"} and remove all synced account data. Your existing transactions will remain.`}
                  >
                    <div className="flex gap-3 justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="px-4 py-2 text-sm rounded-md border border-border text-muted hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnlink(item.id)}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm rounded-md bg-danger/15 border border-danger/30 text-danger hover:bg-danger/25 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
                      >
                        {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Unlink
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Accounts list */}
            {item.accounts.length > 0 && (
              <div className="pl-[52px] space-y-1.5">
                {item.accounts.map((acct) => (
                  <div
                    key={acct.id}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-md bg-accent/50"
                    )}
                  >
                    <span className="text-xs text-foreground font-medium">{acct.name}</span>
                    <span className="text-xs text-muted font-mono">
                      {acct.subtype ?? acct.type}
                      {acct.mask ? ` ····${acct.mask}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
