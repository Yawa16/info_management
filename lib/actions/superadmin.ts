"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserManagementActionState } from "./user-management-types";

type SuperadminContext = {
  userId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
};

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function errorState(message: string): UserManagementActionState {
  return { status: "error", message };
}

async function getSuperadminContext(): Promise<
  | { context: SuperadminContext; error?: never }
  | { context?: never; error: string }
> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Unable to initialize Superadmin authorization.", error);
    return { error: "Superadmin controls are temporarily unavailable." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Unable to verify Superadmin caller.", authError);
  }
  if (!user) {
    return { error: "Sign in with a Superadmin account to perform this action." };
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    console.error("Superadmin service client is not configured.", error);
    return { error: "Superadmin controls are temporarily unavailable." };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, approval_status, is_blocked")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to load Superadmin caller profile.", {
      code: profileError.code,
      message: profileError.message,
      userId: user.id,
    });
    return { error: "We could not verify your permissions. Please try again." };
  }
  if (
    !profile ||
    profile.role !== "superadmin" ||
    !["active", "approved"].includes(profile.approval_status) ||
    profile.is_blocked
  ) {
    return { error: "Only an active, unblocked Superadmin can perform this action." };
  }

  return { context: { userId: user.id, supabase, adminClient } };
}

export async function rejectPendingUser(
  _previousState: UserManagementActionState,
  formData: FormData,
): Promise<UserManagementActionState> {
  const userId = getFormString(formData, "userId");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return errorState("Select a valid pending account.");
  }

  const { context, error } = await getSuperadminContext();
  if (!context) {
    return errorState(error);
  }

  const { data: rejectedUser, error: rejectError } = await context.adminClient
    .from("profiles")
    .update({ approval_status: "rejected" })
    .eq("id", userId)
    .eq("role", "user")
    .eq("approval_status", "pending")
    .select("id")
    .maybeSingle();

  if (rejectError) {
    console.error("Unable to reject pending account.", {
      code: rejectError.code,
      message: rejectError.message,
      userId,
      rejectedBy: context.userId,
    });
    return errorState("We could not reject that account. Please try again.");
  }
  if (!rejectedUser) {
    return errorState("That account is no longer pending or is not a regular User.");
  }

  revalidatePath("/users");
  return {
    status: "success",
    message: "Account rejected. It can no longer access the ERP.",
  };
}

export async function setManagedUserRole(
  _previousState: UserManagementActionState,
  formData: FormData,
): Promise<UserManagementActionState> {
  const userId = getFormString(formData, "userId");
  const requestedRole = getFormString(formData, "role");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ||
    (requestedRole !== "admin" && requestedRole !== "user")
  ) {
    return errorState("Select a valid account and role.");
  }

  const { context, error } = await getSuperadminContext();
  if (!context) {
    return errorState(error);
  }
  if (userId === context.userId) {
    return errorState("You cannot change your own role.");
  }

  const { data: target, error: targetError } = await context.adminClient
    .from("profiles")
    .select("role, approval_status, is_blocked")
    .eq("id", userId)
    .maybeSingle();

  if (targetError) {
    console.error("Unable to load account for role change.", {
      code: targetError.code,
      message: targetError.message,
      targetId: userId,
    });
    return errorState("We could not load that account. Please try again.");
  }
  if (!target || (target.role !== "admin" && target.role !== "user")) {
    return errorState("Only regular User and Admin accounts can change roles.");
  }
  if (target.is_blocked || !["active", "approved"].includes(target.approval_status)) {
    return errorState("Only active, unblocked accounts can change roles.");
  }
  if (target.role === requestedRole) {
    return errorState(`This account is already a ${requestedRole}.`);
  }

  const { data: updatedTarget, error: updateError } = await context.supabase
    .from("profiles")
    .update({ role: requestedRole })
    .eq("id", userId)
    .eq("role", target.role)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Unable to change managed account role.", {
      code: updateError.code,
      message: updateError.message,
      targetId: userId,
      changedBy: context.userId,
    });
    return errorState("We could not change that role. Please try again.");
  }
  if (!updatedTarget) {
    return errorState("That account changed before the role update. Refresh and try again.");
  }

  revalidatePath("/users");
  return {
    status: "success",
    message: requestedRole === "admin" ? "User promoted to Admin." : "Admin demoted to User.",
  };
}
