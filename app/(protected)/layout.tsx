import type { ReactNode } from "react";
import ProtectedAppShell from "@/components/ProtectedAppShell";
import { requireApprovedUser } from "@/lib/auth/access";
import { MODULES } from "@/lib/auth/modules";
import { getAccessSnapshot } from "@/lib/auth/permissions";
import { canAccessModule, isManagerRole } from "@/lib/auth/rights-check";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { user, role } = await requireApprovedUser();
  const snapshot = (await getAccessSnapshot(user.id)) ?? {
    role,
    rightCodes: [],
    moduleCodes: [],
  };
  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "D" },
    ...MODULES.filter((module) => canAccessModule(snapshot, module.key)).map(
      (module) => ({
        href: module.href,
        label: module.label,
        icon: module.label.charAt(0),
      }),
    ),
    ...(isManagerRole(role)
      ? [{ href: "/users", label: "User Management", icon: "U" }]
      : []),
    ...(role === "superadmin"
      ? [{ href: "/system-settings", label: "System Settings", icon: "S" }]
      : []),
  ];
  const firstName =
    typeof user.user_metadata.first_name === "string"
      ? user.user_metadata.first_name.trim()
      : "";
  const lastName =
    typeof user.user_metadata.last_name === "string"
      ? user.user_metadata.last_name.trim()
      : "";
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    user.email ||
    "Account";

  return (
    <ProtectedAppShell
      displayName={displayName}
      navItems={navItems}
      role={role}
    >
      {children}
    </ProtectedAppShell>
  );
}
