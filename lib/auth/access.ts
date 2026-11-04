import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileAccess =
  | {
      status: "approved";
      role: string;
      mustChangePassword: boolean;
    }
  | { status: "pending"; role?: undefined }
  | { status: "blocked"; role?: undefined }
    | { status: "rejected"; role?: undefined }
    | { status: "unavailable"; role?: undefined };

export async function getProfileAccess(userId: string): Promise<ProfileAccess> {
  let data;
  try {
    const adminClient = createSupabaseAdminClient();
    const result = await adminClient
      .from("profiles")
      .select("role, approval_status, is_blocked, must_change_password")
      .eq("id", userId)
      .maybeSingle();

    if (result.error) {
      console.error("Unable to verify profile approval status.", {
        code: result.error.code,
        message: result.error.message,
        userId,
      });
      return { status: "unavailable" };
    }

    data = result.data;
  } catch (error) {
    console.error("Unable to access profile approval status.", {
      error,
      userId,
    });
    return { status: "unavailable" };
  }

  if (!data) {
    console.error("No profile exists for authenticated user.", { userId });
    return { status: "unavailable" };
  }

  if (data.is_blocked) {
    return { status: "blocked" };
  }

  if (data.approval_status === "rejected") {
    return { status: "rejected" };
  }

  if (
    data.approval_status === "pending" &&
    ["superadmin", "admin", "user"].includes(data.role)
  ) {
    return { status: "pending" };
  }

  if (
    !["approved", "active"].includes(data.approval_status) ||
    !["superadmin", "admin", "user"].includes(data.role)
  ) {
    console.error("Profile has an unsupported role or approval status.", {
      userId,
      role: data.role,
      approvalStatus: data.approval_status,
    });
    return { status: "unavailable" };
  }

  return {
    status: "approved",
    role: data.role,
    mustChangePassword: data.must_change_password,
  };
}

async function redirectAfterAccessFailure(
  status: "pending" | "blocked" | "rejected" | "unavailable",
  userId: string,
): Promise<never> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Unable to sign out account without access.", {
      code: error.code,
      message: error.message,
      userId,
    });
  }

  redirect(
    status === "pending"
      ? "/login?notice=pending"
      : status === "blocked"
        ? "/login?notice=blocked"
        : status === "rejected"
          ? "/login?notice=rejected"
        : "/login?notice=unavailable",
  );
}

export async function redirectSignedInUser() {
  const cookieStore = await cookies();
  const hasAuthSessionCookie = cookieStore
    .getAll()
    .some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));

  if (!hasAuthSessionCookie) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Unable to verify existing login session.", error);
  }

  if (!user) {
    return;
  }

  const access = await getProfileAccess(user.id);
  if (access.status === "pending") {
    return await redirectAfterAccessFailure("pending", user.id);
  }
  if (access.status === "blocked") {
    return await redirectAfterAccessFailure("blocked", user.id);
  }
  if (access.status === "rejected") {
    return await redirectAfterAccessFailure("rejected", user.id);
  }
  if (access.status === "unavailable") {
    return await redirectAfterAccessFailure("unavailable", user.id);
  }

  if (access.mustChangePassword) {
    redirect("/set-password");
  }

  redirect("/dashboard");
}

export async function requireApprovedUser() {
  const cookieStore = await cookies();
  const hasAuthSessionCookie = cookieStore
    .getAll()
    .some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));

  if (!hasAuthSessionCookie) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Unable to verify Supabase session.", error);
  }

  if (!user) {
    redirect("/login");
  }

  const access = await getProfileAccess(user.id);
  if (access.status === "pending") {
    return await redirectAfterAccessFailure("pending", user.id);
  }
  if (access.status === "blocked") {
    return await redirectAfterAccessFailure("blocked", user.id);
  }
  if (access.status === "rejected") {
    return await redirectAfterAccessFailure("rejected", user.id);
  }
  if (access.status === "unavailable") {
    return await redirectAfterAccessFailure("unavailable", user.id);
  }

  if (access.mustChangePassword) {
    redirect("/set-password");
  }

  return { user, role: access.role };
}

export async function requirePasswordChangeUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Unable to verify first-login password session.", error);
  }

  if (!user) {
    redirect("/login");
  }

  const access = await getProfileAccess(user.id);
  if (access.status === "pending") {
    return await redirectAfterAccessFailure("pending", user.id);
  }
  if (access.status === "blocked") {
    return await redirectAfterAccessFailure("blocked", user.id);
  }
  if (access.status === "rejected") {
    return await redirectAfterAccessFailure("rejected", user.id);
  }
  if (access.status === "unavailable") {
    return await redirectAfterAccessFailure("unavailable", user.id);
  }

  if (!access.mustChangePassword) {
    redirect("/dashboard");
  }

  return user;
}
