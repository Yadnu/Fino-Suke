import { SignIn } from "@clerk/nextjs";
import { TrendingUp } from "lucide-react";

const clerkAppearance = {
  variables: {
    colorBackground: "#1a1a1f",
    colorInputBackground: "#0f0f11",
    colorInputText: "#f4f4f5",
    colorText: "#f4f4f5",
    colorTextSecondary: "#71717a",
    colorPrimary: "#f5c842",
    colorDanger: "#f87171",
    colorSuccess: "#4ade80",
    colorNeutral: "#2a2a32",
    fontFamily: "var(--font-dm-sans), sans-serif",
    fontSize: "14px",
    borderRadius: "8px",
    spacingUnit: "16px",
  },
  elements: {
    rootBox: "w-full",
    card: "bg-surface border border-border shadow-card rounded-lg !shadow-none",
    headerTitle:
      "font-display text-2xl font-bold text-foreground",
    headerSubtitle: "text-muted text-sm",
    socialButtonsBlockButton:
      "bg-background border border-border text-foreground hover:bg-accent transition-colors rounded-md",
    socialButtonsBlockButtonText: "text-sm font-medium",
    dividerLine: "bg-border",
    dividerText: "text-muted text-xs",
    formFieldLabel: "text-sm font-medium text-foreground",
    formFieldInput:
      "bg-background border border-border text-foreground placeholder:text-muted rounded-md focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors",
    formButtonPrimary:
      "bg-gold hover:bg-[#f0bc2e] text-background font-semibold rounded-md transition-colors",
    footerActionLink: "text-gold hover:text-[#f0bc2e] font-medium transition-colors",
    footerActionText: "text-muted",
    identityPreviewText: "text-foreground",
    identityPreviewEditButton: "text-gold hover:text-[#f0bc2e]",
    formFieldSuccessText: "text-success",
    formFieldErrorText: "text-danger text-xs",
    alertText: "text-foreground text-sm",
    alertIcon: "text-danger",
    otpCodeFieldInput:
      "bg-background border border-border text-foreground rounded-md focus:ring-2 focus:ring-gold/50 focus:border-gold",
    userPreviewMainIdentifier: "text-foreground font-medium",
    userPreviewSecondaryIdentifier: "text-muted",
    badge: "bg-teal/15 text-teal border border-teal/30 rounded-pill text-xs font-semibold",
  },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gold/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-teal/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-gold" />
          </div>
          <span className="font-display text-xl font-bold text-foreground tracking-tight">
            fino<span className="text-gold">suke</span>
          </span>
        </div>

        <SignIn appearance={clerkAppearance} />
      </div>
    </div>
  );
}
