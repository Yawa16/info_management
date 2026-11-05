"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ApprovalState = {
  status: "idle" | "error" | "success";
  message: string;
};

export const initialApprovalState: ApprovalState = {
  status: "idle",
  message: "",
};

export type CreateUserState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Partial<
    Record<"firstName" | "lastName" | "email" | "temporaryPassword", string>
  >;
};

export const initialCreateUserState: CreateUserState = {
  status: "idle",
  message: "",
};

function getFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createUserWithTemporaryPassword(
  _previousState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const firstName = getFormValue(formData, "firstName");
  const lastName = getFormValue(formData, "lastName");
  const email = getFormValue(formData, "email").toLowerCase();
  const passwordValue = formData.get("temporaryPassword");
  const temporaryPassword =
    typeof passwordValue === "string" ? passwordValue : "";
  const fieldErrors: NonNullable<CreateUserState["fieldErrors"]> = {};

  if (!firstName || firstName.length > 80) {
    fieldErrors.firstName = "Enter a first name (maximum 80 characters).";
  }
  if (!lastName || lastName.length > 80) {
    fieldErrors.lastName = "Enter a last name (maximum 80 characters).";
  }
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (temporaryPassword.length < 8 || temporaryPassword.length > 128) {
    fieldErrors.temporaryPassword =
      "Temporary password must be between 8 and 128 characters.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Temporary-password user creation is not configured.", error);
    return {
      status: "error",
      message: "User creation is temporarily unavailable. Please contact support.",
    };
  }

  const {
    data: { user: actor },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Unable to verify user-creation permissions.", authError);
  }
  if (!actor) {
    return {
      status: "error",
      message: "Sign in with an approved Admin or Superadmin account.",
    };
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    console.error("Temporary-password user creation is not configured.", error);
    return {
      status: "error",
      message: "User creation is temporarily unavailable. Please contact support.",
    };
  }

  const actorResult = await adminClient
    .from("profiles")
    .select("role, approval_status, is_blocked")
    .eq("id", actor.id)
    .maybeSingle();

  if (actorResult.error) {
    console.error("Unable to verify user-creation permissions.", {
      code: actorResult.error.code,
      message: actorResult.error.message,
      userId: actor.id,
    });
    return {
      status: "error",
      message: "We couldn’t verify your permissions. Please try again.",
    };
  }

  if (
    !actorResult.data ||
    actorResult.data.approval_status !== "approved" ||
    actorResult.data.is_blocked ||
    !["admin", "superadmin"].includes(actorResult.data.role)
  ) {
    return {
      status: "error",
      message: "Only an approved, unblocked Admin or Superadmin can create users.",
    };
  }

  let createdUserId: string;
  try {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (error || !data.user) {
      if (error) {
        console.error("Supabase Auth could not create the user.", {
          code: error.code,
          message: error.message,
          createdBy: actor.id,
        });
      } else {
        console.error("Supabase Auth returned no user during account creation.", {
          createdBy: actor.id,
        });
      }

      return {
        status: "error",
        message:
          "We couldn’t create that account. Check the email and password requirements.",
      };
    }

    createdUserId = data.user.id;
  } catch (error) {
    console.error("Supabase Auth user-creation request failed.", {
      error,
      createdBy: actor.id,
    });
    return {
      status: "error",
      message: "User creation is temporarily unavailable. Please try again.",
    };
  }

  try {
    const { error } = await adminClient.from("profiles").insert({
      id: createdUserId,
      first_name: firstName,
      last_name: lastName,
      email,
      role: "user",
      approval_status: "approved",
      must_change_password: true,
      is_blocked: false,
    });

    if (error) {
      console.error("Profile creation failed for Admin-created user.", {
        code: error.code,
        message: error.message,
        userId: createdUserId,
        createdBy: actor.id,
      });

      const { error: cleanupError } =
        await adminClient.auth.admin.deleteUser(createdUserId);
      if (cleanupError) {
        console.error("Unable to clean up Auth user after profile failure.", {
          code: cleanupError.code,
          message: cleanupError.message,
          userId: createdUserId,
          createdBy: actor.id,
        });
      }

      return {
        status: "error",
        message:
          "We couldn’t finish creating the profile. Please try again or contact support.",
      };
    }
  } catch (error) {
    console.error("Profile insert request failed for Admin-created user.", {
      error,
      userId: createdUserId,
      createdBy: actor.id,
    });

    try {
      const { error: cleanupError } =
        await adminClient.auth.admin.deleteUser(createdUserId);
      if (cleanupError) {
        console.error("Unable to clean up Auth user after profile failure.", {
          code: cleanupError.code,
          message: cleanupError.message,
          userId: createdUserId,
          createdBy: actor.id,
        });
      }
    } catch (cleanupError) {
      console.error("Auth-user cleanup request failed after profile failure.", {
        error: cleanupError,
        userId: createdUserId,
        createdBy: actor.id,
      });
    }

    return {
      status: "error",
      message:
        "We couldn’t finish creating the profile. Please try again or contact support.",
    };
  }

  revalidatePath("/users");
  return {
    status: "success",
    message:
      "User created. Share the temporary password with them securely; they must set a new password at first sign-in.",
  };
}

export async function approvePendingUser(
  _previousState: ApprovalState,
  formData: FormData,
): Promise<ApprovalState> {
  const targetUserIdValue = formData.get("userId");
  const targetUserId =
    typeof targetUserIdValue === "string" ? targetUserIdValue.trim() : "";

  const isValidUserId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      targetUserId,
    );
  if (!isValidUserId) {
    return {
      status: "error",
      message: "Select a valid pending user.",
    };
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("User approval is not configured.", error);
    return {
      status: "error",
      message: "Approval is temporarily unavailable. Please contact support.",
    };
  }

  const {
    data: { user: actor },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Unable to verify user approving account.", authError);
  }

  if (!actor) {
    return {
      status: "error",
      message: "Sign in with an Admin or Superadmin account to approve users.",
    };
  }

  const adminClient = createSupabaseAdminClient();
  const actorResult = await adminClient
    .from("profiles")
    .select("role, approval_status, is_blocked")
    .eq("id", actor.id)
    .maybeSingle();

  if (actorResult.error) {
    console.error("Unable to verify approver permissions.", {
      code: actorResult.error.code,
      message: actorResult.error.message,
      userId: actor.id,
    });
    return {
      status: "error",
      message: "We couldn’t verify your approval permissions.",
    };
  }

  if (
    !actorResult.data ||
    actorResult.data.approval_status !== "approved" ||
    actorResult.data.is_blocked ||
    !["admin", "superadmin"].includes(actorResult.data.role)
  ) {
    return {
      status: "error",
      message: "Only an approved, unblocked Admin or Superadmin can approve users.",
    };
  }

  const { data: updatedUsers, error: updateError } = await adminClient
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", targetUserId)
    .eq("role", "user")
    .eq("approval_status", "pending")
    .select("id");

  if (updateError) {
    console.error("Unable to approve pending user.", {
      code: updateError.code,
      message: updateError.message,
      userId: targetUserId,
      approvedBy: actor.id,
    });
    return {
      status: "error",
      message: "We couldn’t approve that account. Please try again.",
    };
  }

  if (!updatedUsers?.length) {
    return {
      status: "error",
      message:
        "That account is no longer pending or is not a regular User account.",
    };
  }

  revalidatePath("/users");
  revalidatePath("/dashboard");
  return {
    status: "success",
    message: "User approved. They can now sign in to Hope.",
  };
}
