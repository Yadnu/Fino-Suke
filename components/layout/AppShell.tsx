import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { InstallPrompt } from "./InstallPrompt";
import { OfflineBanner } from "./OfflineBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Offline connectivity banner */}
      <OfflineBanner />

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
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* PWA install prompt */}
      <InstallPrompt />
    </div>
  );
}
