import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileAccess =
  | { status: "approved"; role: string }
  | { status: "pending" | "unavailable"; role?: undefined };

export async function getProfileAccess(userId: string): Promise<ProfileAccess> {
  let data;
  try {
    const adminClient = createSupabaseAdminClient();
    const result = await adminClient
      .from("profiles")
      .select("role, approval_status")
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

  if (
    data.approval_status === "pending" &&
    ["superadmin", "admin", "user"].includes(data.role)
  ) {
    return { status: "pending" };
  }

  if (
    data.approval_status !== "approved" ||
    !["superadmin", "admin", "user"].includes(data.role)
  ) {
    console.error("Profile has an unsupported role or approval status.", {
      userId,
      role: data.role,
      approvalStatus: data.approval_status,
    });
    return { status: "unavailable" };
  }

  return { status: "approved", role: data.role };
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
  if (access.status !== "approved") {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error("Unable to sign out account without approved access.", {
        code: signOutError.code,
        message: signOutError.message,
        userId: user.id,
      });
    }

    redirect(
      access.status === "pending"
        ? "/login?notice=pending"
        : "/login?notice=unavailable",
    );
  }

  return { user, role: access.role };
}
