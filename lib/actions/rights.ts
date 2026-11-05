"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  LoadRightsResult,
  RightsModule,
  SaveRightsResult,
} from "./rights-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOT_ALLOWED = "You are not allowed to change this account's rights.";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type RightRow = {
  id: number;
  code: string;
  label: string;
  sort_order: number;
  module:
    | { code: string; name: string; sort_order: number }
    | { code: string; name: string; sort_order: number }[]
    | null;
};

// Server-side gate: caller must be an active Admin/Superadmin and the target
// must be an active regular User other than the caller. Admins can therefore
// never reach Superadmin (or Admin) accounts.
async function authorizeRightsChange(targetId: string): Promise<
  | {
      actorId: string;
      adminClient: AdminClient;
      targetName: string;
      error?: undefined;
    }
  | { error: string }
> {
  if (!UUID_PATTERN.test(targetId)) {
    return { error: "Select a valid account." };
  }

  let adminClient: AdminClient;
  let userId: string | undefined;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    console.error("Unable to initialize rights authorization.", error);
    return { error: "Rights management is temporarily unavailable." };
  }
  if (!userId) {
    return { error: "Sign in to manage rights." };
  }

  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name, role, approval_status, is_blocked")
    .in("id", [userId, targetId]);

  if (error) {
    console.error("Unable to verify rights change.", {
      code: error.code,
      message: error.message,
    });
    return { error: "We could not verify your permissions. Please try again." };
  }

  const actor = profiles?.find((profile) => profile.id === userId);
  const target = profiles?.find((profile) => profile.id === targetId);

  if (
    !actor ||
    (actor.role !== "admin" && actor.role !== "superadmin") ||
    !["active", "approved"].includes(actor.approval_status) ||
    actor.is_blocked
  ) {
    return { error: NOT_ALLOWED };
  }
  if (
    !target ||
    target.id === actor.id ||
    target.role !== "user" ||
    !["active", "approved"].includes(target.approval_status)
  ) {
    return { error: NOT_ALLOWED };
  }

  return {
    actorId: actor.id,
    adminClient,
    targetName:
      [target.first_name, target.last_name].filter(Boolean).join(" ") ||
      "this user",
  };
}

export async function loadUserRights(
  targetId: string,
): Promise<LoadRightsResult> {
  const auth = await authorizeRightsChange(targetId);
  if (auth.error !== undefined) {
    return { status: "error", message: auth.error };
  }
  const { adminClient, targetName } = auth;

  const [catalogue, granted] = await Promise.all([
    adminClient
      .from("rights")
      .select("id, code, label, sort_order, module:module_id(code, name, sort_order)")
      .eq("status", "Active"),
    adminClient.from("user_rights").select("right_id").eq("user_id", targetId),
  ]);

  if (catalogue.error || granted.error) {
    const failure = catalogue.error ?? granted.error;
    console.error("Unable to load rights dialog data.", {
      code: failure?.code,
      message: failure?.message,
    });
    return { status: "error", message: "We could not load rights. Please try again." };
  }

  const modules = new Map<
    string,
    Omit<RightsModule, "rights"> & {
      order: number;
      rights: (RightsModule["rights"][number] & { order: number })[];
    }
  >();
  for (const row of (catalogue.data ?? []) as unknown as RightRow[]) {
    const moduleInfo = Array.isArray(row.module) ? row.module[0] : row.module;
    if (!moduleInfo) continue;
    const entry = modules.get(moduleInfo.code) ?? {
      code: moduleInfo.code,
      name: moduleInfo.name,
      order: moduleInfo.sort_order,
      rights: [],
    };
    entry.rights.push({ id: row.id, code: row.code, label: row.label, order: row.sort_order });
    entry.rights.sort((a, b) => a.order - b.order);
    modules.set(moduleInfo.code, entry);
  }

  return {
    status: "success",
    data: {
      userName: targetName,
      modules: [...modules.values()]
        .sort((a, b) => a.order - b.order)
        .map(({ code, name, rights }) => ({
          code,
          name,
          rights: rights.map(({ id, code, label }) => ({ id, code, label })),
        })),
      grantedRightIds: (granted.data ?? []).map((row) => Number(row.right_id)),
    },
  };
}

export async function saveUserRights(
  targetId: string,
  rightIds: number[],
): Promise<SaveRightsResult> {
  if (
    !Array.isArray(rightIds) ||
    rightIds.length > 500 ||
    !rightIds.every((id) => Number.isSafeInteger(id) && id > 0)
  ) {
    return { status: "error", message: "Select valid rights." };
  }

  const auth = await authorizeRightsChange(targetId);
  if (auth.error !== undefined) {
    return { status: "error", message: auth.error };
  }
  const { actorId, adminClient } = auth;

  const { error } = await adminClient.rpc("save_user_rights", {
    p_actor_id: actorId,
    p_target_id: targetId,
    p_right_ids: [...new Set(rightIds)],
  });

  if (error) {
    console.error("Unable to save user rights.", {
      code: error.code,
      message: error.message,
      targetId,
      actorId,
    });
    return {
      status: "error",
      message:
        error.code === "42501" || error.code === "23514"
          ? error.message
          : "We could not save rights. Please try again.",
    };
  }

  revalidatePath("/users");
  return { status: "success", message: "Rights saved." };
}
