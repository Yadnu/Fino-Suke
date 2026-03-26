"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  Wallet,
  Target,
  Bell,
  BarChart3,
  TrendingUp,
  Sparkles,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/expenses", icon: Receipt, label: "Expenses" },
  { href: "/budget", icon: PieChart, label: "Budget" },
  { href: "/income", icon: Wallet, label: "Income" },
  { href: "/savings", icon: Target, label: "Savings" },
  { href: "/bills", icon: Bell, label: "Bills" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/networth", icon: TrendingUp, label: "Net Worth" },
  { href: "/ai-assistant", icon: Sparkles, label: "AI Assistant" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-surface border-r border-border flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-gold" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            fino<span className="text-gold">suke</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150",
                  isActive
                    ? "bg-gold/10 text-gold font-medium"
                    : "text-muted hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isActive ? "text-gold" : "text-muted"
                  )}
                />
                {label}
                {label === "AI Assistant" && (
                  <span className="ml-auto text-[10px] font-bold bg-teal/20 text-teal px-1.5 py-0.5 rounded-pill">
                    AI
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border px-3 py-3 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all",
            pathname.startsWith("/settings")
              ? "bg-gold/10 text-gold font-medium"
              : "text-muted hover:text-foreground hover:bg-accent"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Settings
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted hover:text-danger hover:bg-danger/10 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
