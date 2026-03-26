"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Loader2, User, Palette, Globe, Mail, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectItem } from "@/components/ui/Select";
import { Controller } from "react-hook-form";

const settingsSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  currency: z.string().length(3, "Must be a 3-letter code"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const CURRENCIES = [
  { code: "USD", label: "US Dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "JPY", label: "Japanese Yen (JPY)" },
  { code: "CAD", label: "Canadian Dollar (CAD)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "CNY", label: "Chinese Yuan (CNY)" },
  { code: "INR", label: "Indian Rupee (INR)" },
  { code: "BRL", label: "Brazilian Real (BRL)" },
  { code: "MXN", label: "Mexican Peso (MXN)" },
  { code: "SGD", label: "Singapore Dollar (SGD)" },
  { code: "HKD", label: "Hong Kong Dollar (HKD)" },
  { code: "KRW", label: "South Korean Won (KRW)" },
  { code: "IDR", label: "Indonesian Rupiah (IDR)" },
  { code: "MYR", label: "Malaysian Ringgit (MYR)" },
  { code: "PHP", label: "Philippine Peso (PHP)" },
  { code: "THB", label: "Thai Baht (THB)" },
  { code: "VND", label: "Vietnamese Dong (VND)" },
  { code: "TRY", label: "Turkish Lira (TRY)" },
  { code: "ZAR", label: "South African Rand (ZAR)" },
  { code: "AED", label: "UAE Dirham (AED)" },
  { code: "SAR", label: "Saudi Riyal (SAR)" },
  { code: "NGN", label: "Nigerian Naira (NGN)" },
  { code: "EGP", label: "Egyptian Pound (EGP)" },
];

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gold" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user: clerkUser } = useUser();
  const [isFetching, setIsFetching] = useState(true);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { name: "", currency: "USD" },
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        reset({
          name: data.name ?? clerkUser?.fullName ?? "",
          currency: data.currency ?? "USD",
        });
      })
      .finally(() => setIsFetching(false));
  }, [reset, clerkUser]);

  async function onSubmit(values: SettingsFormValues) {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "Failed to save settings");
        return;
      }
      reset(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Settings saved");
    } catch {
      toast.error("Something went wrong");
    }
  }

  if (isFetching) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <div className="h-8 w-28 skeleton rounded-md mb-1" />
          <div className="h-4 w-48 skeleton rounded-md" />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-6 space-y-4">
            <div className="h-5 w-32 skeleton rounded-md" />
            <div className="h-10 w-full skeleton rounded-md" />
            <div className="h-10 w-full skeleton rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted mt-1">
          Manage your profile and preferences
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Profile */}
        <div className="bg-surface border border-border rounded-lg p-6">
          <SectionHeader
            icon={User}
            title="Profile"
            description="Your public display name and account email"
          />

          <div className="space-y-4">
            {/* Avatar + name row */}
            <div className="flex items-center gap-4">
              {clerkUser?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clerkUser.imageUrl}
                  alt="Avatar"
                  className="w-14 h-14 rounded-xl object-cover border border-border"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-gold" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted mb-0.5">Profile photo</p>
                <p className="text-xs text-muted">
                  Managed via your Clerk account
                </p>
              </div>
            </div>

            {/* Display name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Display name
              </label>
              <input
                {...register("name")}
                className="input-field"
                placeholder="Your name"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
              )}
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  value={clerkUser?.primaryEmailAddress?.emailAddress ?? ""}
                  readOnly
                  className="input-field pl-9 text-muted cursor-default select-none"
                />
              </div>
              <p className="text-xs text-muted mt-1">
                Email is managed via Clerk — change it in your account settings
              </p>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-surface border border-border rounded-lg p-6">
          <SectionHeader
            icon={Palette}
            title="Preferences"
            description="Currency used across the app for formatting and display"
          />

          <div className="space-y-4">
            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Currency
              </label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select currency"
                  >
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
              {errors.currency && (
                <p className="mt-1 text-xs text-danger">
                  {errors.currency.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Account info */}
        <div className="bg-surface border border-border rounded-lg p-6">
          <SectionHeader
            icon={Globe}
            title="Account"
            description="Account details managed by Clerk"
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted">User ID</span>
              <span className="text-xs text-muted font-mono truncate max-w-48">
                {clerkUser?.id ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted">Account created</span>
              <span className="text-sm text-foreground">
                {clerkUser?.createdAt
                  ? new Date(clerkUser.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-1">
          {saved && (
            <div className="flex items-center gap-1.5 text-success text-sm">
              <Check className="w-4 h-4" />
              Saved
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold transition-colors",
              isDirty
                ? "bg-gold text-background hover:bg-gold-hover"
                : "bg-gold/30 text-background/60 cursor-not-allowed",
              "disabled:opacity-60"
            )}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
