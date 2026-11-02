import { redirect } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import PasswordUpdateForm from "@/components/PasswordUpdateForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Unable to verify password reset session.", {
      code: error.code,
      message: error.message,
    });
  }

  if (!user) {
    redirect("/reset-password?notice=invalid-link");
  }

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="password-update-title">
        <header className="auth-card-header">
          <div>
            <h1 id="password-update-title">Choose a new password</h1>
            <p className="auth-description">
              Enter and confirm your new password.
            </p>
          </div>
        </header>
        <PasswordUpdateForm />
      </section>
    </AuthLayout>
  );
}
