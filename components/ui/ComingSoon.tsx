import { Construction } from "lucide-react";

type ComingSoonProps = {
  title: string;
  description?: string;
  phase?: string;
};

export function ComingSoon({
  title,
  description = "This feature is being built and will be available soon.",
  phase = "Phase 2",
}: ComingSoonProps) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {title}
        </h1>
      </div>
      <div className="bg-surface border border-border rounded-lg p-12 text-center">
        <div className="w-14 h-14 rounded-lg bg-teal/10 border border-teal/20 flex items-center justify-center mx-auto mb-5">
          <Construction className="w-7 h-7 text-teal" />
        </div>
        <p className="font-display text-lg font-semibold text-foreground mb-2">
          Coming in {phase}
        </p>
        <p className="text-sm text-muted max-w-xs mx-auto">{description}</p>
        <div className="mt-5 inline-flex items-center gap-2 bg-teal/10 border border-teal/20 rounded-pill px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
          <span className="text-xs font-semibold text-teal">In development</span>
        </div>
      </div>
    </div>
  );
}
