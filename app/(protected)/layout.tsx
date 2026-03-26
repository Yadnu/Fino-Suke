import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PushRegistrar } from "@/components/layout/PushRegistrar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/auth/login");

  return (
    <>
      <PushRegistrar />
      <AppShell>{children}</AppShell>
    </>
  );
}
