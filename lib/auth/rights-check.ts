import type { SupabaseClient } from "@supabase/supabase-js";
import { getModule, type ModuleKey } from "./modules";

// Shared by middleware and server code, so it must not import server-only code.
export type AccessSnapshot = {
  role: string;
  rightCodes: string[];
  moduleCodes: string[];
};

type RightRow = {
  code: string;
  mod: { code: string } | { code: string }[] | null;
};

type UserRightRow = { rights: RightRow | RightRow[] | null };

const ACTIVE_STATUSES = ["active", "approved"];

export async function loadAccessSnapshot(
  client: SupabaseClient,
  userId: string,
): Promise<AccessSnapshot | null> {
  const { data: profile, error } = await client
    .from("profiles")
    .select("role, approval_status, is_blocked")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Unable to load profile for permission check.", {
      code: error.code,
      message: error.message,
    });
    return null;
  }

  if (
    !profile ||
    profile.is_blocked ||
    !ACTIVE_STATUSES.includes(profile.approval_status)
  ) {
    return null;
  }

  if (profile.role !== "user") {
    return { role: profile.role, rightCodes: [], moduleCodes: [] };
  }

  const { data, error: rightsError } = await client
    .from("user_rights")
    .select("rights:right_id(code, mod:module_id(code))")
    .eq("user_id", userId);

  if (rightsError) {
    console.error("Unable to load rights for permission check.", {
      code: rightsError.code,
      message: rightsError.message,
    });
    return null;
  }

  const rightCodes = new Set<string>();
  const moduleCodes = new Set<string>();
  for (const row of (data ?? []) as unknown as UserRightRow[]) {
    const right = Array.isArray(row.rights) ? row.rights[0] : row.rights;
    if (!right) continue;
    rightCodes.add(right.code);
    const mod = Array.isArray(right.mod) ? right.mod[0] : right.mod;
    if (mod) moduleCodes.add(mod.code);
  }

  return {
    role: profile.role,
    rightCodes: [...rightCodes],
    moduleCodes: [...moduleCodes],
  };
}

export function isManagerRole(role: string) {
  return role === "admin" || role === "superadmin";
}

// Admins and Superadmins have every mod; a User needs at least one right in
// the mod, or the exact right when an action is given (e.g. "add" or
// "job_edit" -> CUSTOMER_ADD / HR_JOB_EDIT).
export function canAccessModule(
  snapshot: AccessSnapshot,
  moduleKey: ModuleKey,
  action?: string,
) {
  const mod = getModule(moduleKey);
  if (!mod) return false;
  if (isManagerRole(snapshot.role)) return true;

  if (action) {
    const code = `${mod.rightPrefix}_${action}`.toUpperCase();
    return snapshot.rightCodes.includes(code);
  }
  return snapshot.moduleCodes.includes(mod.rightsModule);
}
