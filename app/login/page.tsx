import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

const notices: Record<string, string> = {
  pending: "Your account is waiting for approval.",
  unavailable:
    "We can’t verify account access right now. Please contact support.",
  "confirmation-error":
    "We couldn’t verify that link. Request a new confirmation email and try again.",
  "google-error":
    "We couldn’t complete Google sign-up. Please try again or contact support.",
  "password-updated": "Your password was updated. Sign in with your new password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;

  return (
    <AuthLayout>
      <AuthForm mode="login" notice={notice ? notices[notice] ?? "" : ""} />
    </AuthLayout>
  );
}
