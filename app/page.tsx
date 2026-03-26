import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  else redirect("/auth/login");
}
