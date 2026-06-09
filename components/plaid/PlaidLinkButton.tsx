"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import type { PlaidLinkOnSuccess, PlaidLinkOptions } from "react-plaid-link";
import { Loader2, Link2 } from "lucide-react";
import toast from "react-hot-toast";

type Props = {
  onSuccess?: () => void;
};

export function PlaidLinkButton({ onSuccess }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    setFetching(true);
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.link_token) setLinkToken(data.link_token);
        else toast.error("Could not initialise bank link");
      })
      .catch(() => toast.error("Could not initialise bank link"))
      .finally(() => setFetching(false));
  }, []);

  const handleSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setExchanging(true);
      try {
        const institution = metadata.institution;
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_name: institution?.name ?? null,
            institution_id: institution?.institution_id ?? null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Failed to connect bank");
          return;
        }
        toast.success("Bank connected!");
        onSuccess?.();
      } catch {
        toast.error("Failed to connect bank");
      } finally {
        setExchanging(false);
      }
    },
    [onSuccess]
  );

  const config: PlaidLinkOptions = {
    token: linkToken ?? "",
    onSuccess: handleSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  const disabled = fetching || exchanging || !ready || !linkToken;

  return (
    <button
      type="button"
      onClick={() => open()}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-gold text-background hover:bg-gold-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {fetching || exchanging ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Link2 className="w-4 h-4" />
      )}
      {exchanging ? "Connecting…" : "Connect a bank"}
    </button>
  );
}
