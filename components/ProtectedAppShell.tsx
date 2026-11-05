"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOutUser } from "@/lib/actions/auth";

export type NavItem = { href: string; label: string; icon: string };

export default function ProtectedAppShell({
  children,
  displayName,
  navItems,
  role,
}: {
  children: ReactNode;
  displayName: string;
  navItems: NavItem[];
  role: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(true);
  const isCurrent = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const currentLabel =
    navItems.find((item) => isCurrent(item.href))?.label ??
    (pathname === "/no-access" ? "No access" : "Dashboard");

  return (
    <div className={`erp-shell${menuOpen ? "" : " erp-shell-menu-closed"}`}>
      <aside className="erp-sidebar" aria-label="ERP navigation">
        <Link className="erp-brand" href="/dashboard">
          <span className="erp-brand-mark">H</span>
          <span>HOPE ERP</span>
        </Link>
        <nav className="erp-side-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className={`erp-nav-link${isCurrent(item.href) ? " is-active" : ""}`}
              href={item.href}
              key={item.href}
              onClick={() => setMenuOpen(true)}
            >
              <span className="erp-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="erp-main-column">
        <header className="erp-topbar">
          <div className="erp-topbar-left">
            <button
              aria-expanded={menuOpen}
              className="erp-menu-toggle"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              {menuOpen ? "Close menu" : "Open menu"}
            </button>
            <span>{currentLabel}</span>
          </div>
          <div className="erp-account">
            <span className="erp-account-name">{displayName}</span>
            <span className={`erp-role-badge role-${role}`}>{role}</span>
            <form action={signOutUser}>
              <button className="erp-logout" type="submit">
                Log out
              </button>
            </form>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
