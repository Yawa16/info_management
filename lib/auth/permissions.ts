import "server-only";

import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/access";
import { MODULES, type ModuleKey } from "@/lib/auth/modules";
import {
  canAccessModule,
  isManagerRole,
  loadAccessSnapshot,
  type AccessSnapshot,
} from "@/lib/auth/rights-check";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const NO_ACCESS_PATH = "/no-access";

export async function getAccessSnapshot(userId: string) {
  return loadAccessSnapshot(createSupabaseAdminClient(), userId);
}

// Page / server action guard: signed-in, active and holding the right, else
// redirect to the "No access" page. Call it first in every module page.
export async function requireRight(moduleKey: ModuleKey, action?: string) {
  const { user } = await requireApprovedUser();
  const snapshot = await getAccessSnapshot(user.id);

  if (!snapshot || !canAccessModule(snapshot, moduleKey, action)) {
    redirect(NO_ACCESS_PATH);
  }
  return { user, snapshot };
}

export async function requireManager(superadminOnly = false) {
  const { user } = await requireApprovedUser();
  const snapshot = await getAccessSnapshot(user.id);

  if (
    !snapshot ||
    (superadminOnly ? snapshot.role !== "superadmin" : !isManagerRole(snapshot.role))
  ) {
    redirect(NO_ACCESS_PATH);
  }
  return { user, snapshot };
}

// Non-redirecting variant for route handlers, which must answer with a status.
export async function hasRight(
  userId: string,
  moduleKey: ModuleKey,
  action?: string,
) {
  const snapshot = await getAccessSnapshot(userId);
  return Boolean(snapshot && canAccessModule(snapshot, moduleKey, action));
}

export type ModuleStat = { value: number | null; caption: string };

async function countActive(table: string): Promise<number | null> {
  const { count, error } = await createSupabaseAdminClient()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("status", "Active");

  if (error) {
    console.error("Unable to load dashboard statistic.", {
      table,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  return count ?? 0;
}

async function countActiveAccounts(): Promise<number | null> {
  const { count, error } = await createSupabaseAdminClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("approval_status", ["active", "approved"])
    .eq("is_blocked", false);

  if (error) {
    console.error("Unable to load account statistic.", {
      code: error.code,
      message: error.message,
    });
    return null;
  }
  return count ?? 0;
}

async function countReportRights(snapshot: AccessSnapshot) {
  if (!isManagerRole(snapshot.role)) {
    return snapshot.rightCodes.filter((code) => code.startsWith("REPORT_"))
      .length;
  }
  const { count, error } = await createSupabaseAdminClient()
    .from("rights")
    .select("id", { count: "exact", head: true })
    .like("code", "REPORT_%");
  if (error) {
    console.error("Unable to count reports.", { code: error.code });
    return null;
  }
  return count ?? 0;
}

// Real counts, fetched only for modules the user can open.
export async function getDashboardStats(snapshot: AccessSnapshot) {
  const allowed = (key: ModuleKey) => canAccessModule(snapshot, key);
  const [customers, products, employees, sales, reports, accounts] =
    await Promise.all([
      allowed("customers") ? countActive("customer") : null,
      allowed("products") ? countActive("product") : null,
      allowed("human-resources") ? countActive("employee") : null,
      allowed("sales") ? countActive("sales") : null,
      allowed("reports") ? countReportRights(snapshot) : null,
      isManagerRole(snapshot.role) ? countActiveAccounts() : null,
    ]);

  const stats: Record<string, ModuleStat> = {
    customers: { value: customers, caption: "Active customers" },
    products: { value: products, caption: "Active products" },
    "human-resources": { value: employees, caption: "Active employees" },
    sales: { value: sales, caption: "Active sales" },
    reports: { value: reports, caption: "Reports available" },
    users: { value: accounts, caption: "Active accounts" },
  };
  return stats;
}

export function getAllowedModuleKeys(snapshot: AccessSnapshot) {
  return MODULES.filter((module) => canAccessModule(snapshot, module.key)).map(
    (module) => module.key,
  );
}
