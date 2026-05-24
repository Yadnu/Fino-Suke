import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PushRegistrar } from "@/components/layout/PushRegistrar";
import { UserSettingsProvider } from "@/lib/context/UserSettingsContext";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/auth/login");

  return (
    <UserSettingsProvider>
      <PushRegistrar />
      <AppShell>{children}</AppShell>
    </UserSettingsProvider>
  );
}
