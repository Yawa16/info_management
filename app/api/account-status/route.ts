import { NextResponse } from "next/server";
import { getProfileAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Unable to verify approval status session.", authError);
      return NextResponse.json({ status: "error" }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ status: "error" }, { status: 401 });
    }

    const access = await getProfileAccess(user.id);
    if (access.status === "pending") {
      return NextResponse.json({ status: "pending" });
    }

    if (access.status === "rejected") {
      return NextResponse.json({ status: "rejected" });
    }

    if (access.status === "blocked") {
      return NextResponse.json({ status: "blocked" });
    }

    if (access.status === "approved") {
      return NextResponse.json({
        status: "active",
        nextPath: access.mustChangePassword ? "/set-password" : "/dashboard",
      });
    }

    return NextResponse.json({ status: "error" }, { status: 500 });
  } catch (error) {
    console.error("Account approval status check failed.", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
