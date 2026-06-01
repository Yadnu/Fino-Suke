import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { InstallPrompt } from "./InstallPrompt";
import { OfflineBanner } from "./OfflineBanner";
import { SwUpdateBanner } from "./SwUpdateBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Offline connectivity banner */}
      <OfflineBanner />

      {/* SW update notification */}
      <SwUpdateBanner />

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="md:ml-[220px] flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6 pb-20 md:pb-6 animate-fade-in">
          {children}
        </main>
        {/* Mobile developer credit — hidden on desktop (sidebar handles it there) */}
        <div className="md:hidden pb-20 flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted/50 tracking-widest uppercase font-medium">crafted by</span>
            <span className="text-[11px] font-bold text-gold tracking-wide">Yadneya</span>
            <span className="text-gold/40 text-[9px] animate-pulse">✦</span>
          </div>
          <p className="text-[9px] text-muted/35 tracking-widest uppercase">
            © 2026 · All rights reserved
          </p>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* PWA install prompt */}
      <InstallPrompt />
    </div>
  );
}
