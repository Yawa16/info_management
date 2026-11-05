import Link from "next/link";
import { requireApprovedUser } from "@/lib/auth/access";
import { MODULES } from "@/lib/auth/modules";
import { getDashboardStats, getAccessSnapshot } from "@/lib/auth/permissions";
import { canAccessModule, isManagerRole } from "@/lib/auth/rights-check";

type Tile = {
  key: string;
  label: string;
  icon: string;
  href: string;
  allowed: boolean;
  stat: { value: number | null; caption: string } | undefined;
  hint: string;
};

export default async function DashboardPage() {
  const { role, user } = await requireApprovedUser();
  const snapshot = (await getAccessSnapshot(user.id)) ?? {
    role,
    rightCodes: [],
    moduleCodes: [],
  };
  const stats = await getDashboardStats(snapshot);
  const firstName =
    typeof user.user_metadata.first_name === "string"
      ? user.user_metadata.first_name.trim()
      : "";
  const greetingName = firstName || user.email?.split("@")[0] || "there";
  const isManager = isManagerRole(role);
  const isSuperadmin = role === "superadmin";

  const tiles: Tile[] = [
    ...MODULES.map((module) => {
      const allowed = canAccessModule(snapshot, module.key);
      return {
        key: module.key,
        label: module.tileLabel,
        icon: module.icon,
        href: module.href,
        allowed,
        stat: allowed ? stats[module.key] : undefined,
        hint: "Ask an Admin to grant you access to this module",
      };
    }),
    {
      key: "users",
      label: "Manage Users",
      icon: "▣",
      href: "/users",
      allowed: isManager,
      stat: isManager ? stats.users : undefined,
      hint: "Only Admins and Superadmins can manage users",
    },
    ...(isSuperadmin
      ? [
          {
            key: "system-settings",
            label: "System Settings",
            icon: "⚙",
            href: "/system-settings",
            allowed: true,
            stat: undefined,
            hint: "",
          },
        ]
      : []),
  ];

  return (
    <main className="erp-dashboard">
      <header className="erp-page-heading dashboard-page-heading">
        <h1>Dashboard</h1>
      </header>

      <section className="erp-welcome">
        <h2>Welcome back, {greetingName}!</h2>
        <p>
          {isSuperadmin
            ? "You have full system access. You can manage all modules and assign roles to any user."
            : isManager
              ? "Manage user accounts and access your available modules."
              : "Your workspace is ready. Choose an available module to get started."}
        </p>
      </section>

      <section aria-labelledby="quick-actions-title" className="erp-quick-actions">
        <h2 id="quick-actions-title">Quick Actions</h2>
        <div className="erp-tile-grid">
          {tiles.map((tile) => {
            const body = (
              <>
                <span className="erp-tile-icon" aria-hidden="true">
                  {tile.icon}
                </span>
                <span className="erp-tile-label">{tile.label}</span>
                {tile.stat && (
                  <span className="erp-tile-stat">
                    <strong>
                      {tile.stat.value === null ? "—" : tile.stat.value}
                    </strong>
                    <small>{tile.stat.caption}</small>
                  </span>
                )}
              </>
            );

            return tile.allowed ? (
              <Link className="erp-tile" href={tile.href} key={tile.key}>
                {body}
              </Link>
            ) : (
              <div
                aria-disabled="true"
                className="erp-tile is-disabled"
                key={tile.key}
                title={tile.hint}
              >
                {body}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
