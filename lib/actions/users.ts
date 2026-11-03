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
    .select("role, approval_status")
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
    !["admin", "superadmin"].includes(actorResult.data.role)
  ) {
    return {
      status: "error",
      message: "Only an approved Admin or Superadmin can approve users.",
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
