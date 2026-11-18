import { redirect } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import ApprovalPendingStatus from "@/components/ApprovalPendingStatus";
import { getProfileAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function redirectAfterSignOut(notice: string): Promise<never> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Unable to sign out account from approval page.", {
      code: error.code,
      message: error.message,
    });
  }
  redirect(`/login?notice=${notice}`);
}

export default async function ApprovalPendingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Unable to verify account on approval page.", error);
  }

  if (!user) {
    redirect("/login");
  }

  const access = await getProfileAccess(user.id);
  if (access.status === "approved") {
    redirect(access.mustChangePassword ? "/set-password" : "/dashboard");
  }
  if (access.status === "rejected") {
    return redirectAfterSignOut("rejected");
  }
  if (access.status === "blocked") {
    return redirectAfterSignOut("blocked");
  }
  if (access.status !== "pending") {
    return redirectAfterSignOut("unavailable");
  }

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="approval-pending-title">
        <header className="auth-card-header">
          <div>
            <h1 id="approval-pending-title">Waiting for approval</h1>
            <p className="auth-description">
              A Superadmin must approve your account before you can continue.
            </p>
          </div>
        </header>
        <ApprovalPendingStatus />
      </section>
    </AuthLayout>
  );
}
