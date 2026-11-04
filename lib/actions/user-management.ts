"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserManagementActionState } from "./user-management-types";

type ManagerContext = {
  userId: string;
  role: "admin" | "superadmin";
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
};

function formString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function getManagerContext(): Promise<
  | { context: ManagerContext; error?: never }
  | { context?: never; error: string }
> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Unable to initialize user-management authorization.", error);
    return { error: "User management is temporarily unavailable." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Unable to verify user-management caller.", authError);
  }
  if (!user) {
    return { error: "Sign in with an approved Admin or Superadmin account." };
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    console.error("User-management service client is not configured.", error);
    return { error: "User management is temporarily unavailable." };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, approval_status, is_blocked")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to load user-management caller profile.", {
      code: profileError.code,
      message: profileError.message,
      userId: user.id,
    });
    return { error: "We could not verify your permissions. Please try again." };
  }

  if (
    !profile ||
    profile.approval_status !== "approved" ||
    profile.is_blocked ||
    (profile.role !== "admin" && profile.role !== "superadmin")
  ) {
    return { error: "Only an approved, unblocked Admin or Superadmin can manage users." };
  }

  return {
    context: {
      userId: user.id,
      role: profile.role,
      supabase,
      adminClient,
    },
  };
}

async function getManageableTarget(
  context: ManagerContext,
  targetId: string,
): Promise<{ ok: true; role: string } | { ok: false; error: string }> {
  if (!targetId || targetId === context.userId) {
    return { ok: false, error: "You cannot manage your own account." };
  }

  const { data: target, error } = await context.adminClient
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .maybeSingle();

  if (error) {
    console.error("Unable to load user-management target profile.", {
      code: error.code,
      message: error.message,
      targetId,
    });
    return { ok: false, error: "We could not load that account. Please try again." };
  }
  if (!target) {
    return { ok: false, error: "That account could not be found." };
  }
  if (context.role === "admin" && target.role !== "user") {
    return { ok: false, error: "Admins can manage regular User accounts only." };
  }

  return { ok: true, role: target.role };
}

function validateIdentity(firstName: string, lastName: string, email: string) {
  return (
    firstName.length > 0 &&
    firstName.length <= 80 &&
    lastName.length > 0 &&
    lastName.length <= 80 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function actionError(message: string): UserManagementActionState {
  return { status: "error", message };
}

export async function createManagedUser(
  _previousState: UserManagementActionState,
  formData: FormData,
): Promise<UserManagementActionState> {
  const firstName = formString(formData, "firstName");
  const lastName = formString(formData, "lastName");
  const email = formString(formData, "email").toLowerCase();

  if (!validateIdentity(firstName, lastName, email)) {
    return actionError("Enter valid first name, last name, and email values.");
  }

  const { context, error } = await getManagerContext();
  if (!context) {
    return actionError(error);
  }

  const temporaryPassword = randomBytes(18).toString("base64url");
  let createdUserId: string;
  try {
    const { data, error: createError } =
      await context.adminClient.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
      });

    if (createError || !data.user) {
      console.error("Supabase Auth could not create managed User.", {
        code: createError?.code,
        message: createError?.message,
        createdBy: context.userId,
      });
      return actionError("We could not create that account. Check the email and try again.");
    }
    createdUserId = data.user.id;
  } catch (createError) {
    console.error("Managed User Auth creation request failed.", {
      error: createError,
      createdBy: context.userId,
    });
    return actionError("User creation is temporarily unavailable. Please try again.");
  }

  try {
    const { error: insertError } = await context.adminClient
      .from("profiles")
      .insert({
        id: createdUserId,
        first_name: firstName,
        last_name: lastName,
        email,
        role: "user",
        approval_status: "approved",
        must_change_password: true,
        is_blocked: false,
      });

    if (insertError) {
      console.error("Managed User profile creation failed.", {
        code: insertError.code,
        message: insertError.message,
        userId: createdUserId,
        createdBy: context.userId,
      });
      const { error: cleanupError } =
        await context.adminClient.auth.admin.deleteUser(createdUserId);
      if (cleanupError) {
        console.error("Unable to clean up Auth user after profile failure.", {
          code: cleanupError.code,
          message: cleanupError.message,
          userId: createdUserId,
        });
      }
      return actionError("We could not finish creating the profile. Please try again.");
    }
  } catch (insertError) {
    console.error("Managed User profile insert request failed.", {
      error: insertError,
      userId: createdUserId,
      createdBy: context.userId,
    });
    try {
      const { error: cleanupError } =
        await context.adminClient.auth.admin.deleteUser(createdUserId);
      if (cleanupError) {
        console.error("Unable to clean up Auth user after profile failure.", {
          code: cleanupError.code,
          message: cleanupError.message,
          userId: createdUserId,
        });
      }
    } catch (cleanupError) {
      console.error("Auth-user cleanup request failed after profile failure.", {
        error: cleanupError,
        userId: createdUserId,
      });
    }
    return actionError("We could not finish creating the profile. Please try again.");
  }

  revalidatePath("/users");
  return {
    status: "success",
    message: "User created. Share this temporary password securely.",
    temporaryPassword,
  };
}

export async function editManagedUser(
  _previousState: UserManagementActionState,
  formData: FormData,
): Promise<UserManagementActionState> {
  const userId = formString(formData, "userId");
  const firstName = formString(formData, "firstName");
  const lastName = formString(formData, "lastName");
  const email = formString(formData, "email").toLowerCase();

  if (!userId || !validateIdentity(firstName, lastName, email)) {
    return actionError("Enter valid first name, last name, and email values.");
  }

  const { context, error } = await getManagerContext();
  if (!context) {
    return actionError(error);
  }
  const target = await getManageableTarget(context, userId);
  if (!target.ok) {
    return actionError(target.error);
  }

  const { data: authUser, error: lookupError } =
    await context.adminClient.auth.admin.getUserById(userId);
  if (lookupError || !authUser.user) {
    console.error("Unable to load Auth account for managed User edit.", {
      code: lookupError?.code,
      message: lookupError?.message,
      targetId: userId,
    });
    return actionError("We could not load that account. Please try again.");
  }

  const originalEmail = authUser.user.email;
  const { error: authUpdateError } =
    await context.adminClient.auth.admin.updateUserById(userId, { email });
  if (authUpdateError) {
    console.error("Unable to update managed User Auth email.", {
      code: authUpdateError.code,
      message: authUpdateError.message,
      targetId: userId,
    });
    return actionError("We could not update that email address.");
  }

  const { data: updatedProfile, error: profileUpdateError } = await context.supabase
    .from("profiles")
    .update({ first_name: firstName, last_name: lastName, email })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (profileUpdateError || !updatedProfile) {
    console.error("Unable to update managed User profile.", {
      code: profileUpdateError?.code,
      message: profileUpdateError?.message ?? "RLS denied or target was not found.",
      targetId: userId,
    });
    if (originalEmail && originalEmail !== email) {
      const { error: rollbackError } =
        await context.adminClient.auth.admin.updateUserById(userId, {
          email: originalEmail,
        });
      if (rollbackError) {
        console.error("Unable to roll back Auth email after profile failure.", {
          code: rollbackError.code,
          message: rollbackError.message,
          targetId: userId,
        });
      }
    }
    return actionError("We could not update that profile. Please try again.");
  }

  revalidatePath("/users");
  return { status: "success", message: "User updated." };
}

export async function setManagedUserBlocked(
  _previousState: UserManagementActionState,
  formData: FormData,
): Promise<UserManagementActionState> {
  const userId = formString(formData, "userId");
  const blockedValue = formString(formData, "blocked");
  if (!userId || (blockedValue !== "true" && blockedValue !== "false")) {
    return actionError("Invalid account status request.");
  }

  const { context, error } = await getManagerContext();
  if (!context) {
    return actionError(error);
  }
  const target = await getManageableTarget(context, userId);
  if (!target.ok) {
    return actionError(target.error);
  }

  const blocked = blockedValue === "true";
  const { data: updatedProfile, error: updateError } = await context.supabase
    .from("profiles")
    .update({ is_blocked: blocked })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedProfile) {
    console.error("Unable to update managed User block status.", {
      code: updateError?.code,
      message: updateError?.message ?? "RLS denied or target was not found.",
      targetId: userId,
      updatedBy: context.userId,
    });
    return actionError("We could not update that account. Please try again.");
  }

  revalidatePath("/users");
  return {
    status: "success",
    message: blocked ? "User blocked." : "User unblocked.",
  };
}
