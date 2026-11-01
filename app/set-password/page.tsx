import AuthLayout from "@/components/AuthLayout";
import PasswordUpdateForm from "@/components/PasswordUpdateForm";
import { requirePasswordChangeUser } from "@/lib/auth/access";

export default async function SetPasswordPage() {
  await requirePasswordChangeUser();

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="set-password-title">
        <header className="auth-card-header">
          <div>
            <h1 id="set-password-title">Set your password</h1>
            <p className="auth-description">
              Choose a new password to finish setting up your account.
            </p>
          </div>
        </header>
        <PasswordUpdateForm mode="first-login" />
      </section>
    </AuthLayout>
  );
}
