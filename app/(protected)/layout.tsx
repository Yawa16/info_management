import type { ReactNode } from "react";
import { requireApprovedUser } from "@/lib/auth/access";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireApprovedUser();
  return children;
}
