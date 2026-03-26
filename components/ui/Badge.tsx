import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "gold" | "teal" | "danger" | "success" | "muted";

const VARIANTS: Record<BadgeVariant, string> = {
  default: "bg-surface border border-border text-foreground",
  gold: "bg-gold/15 border border-gold/30 text-gold",
  teal: "bg-teal/15 border border-teal/30 text-teal",
  danger: "bg-danger/15 border border-danger/30 text-danger",
  success: "bg-success/15 border border-success/30 text-success",
  muted: "bg-accent text-muted",
};

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-pill text-xs font-semibold",
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
