import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";
import { redirectSignedInUser } from "@/lib/auth/access";

const notices: Record<string, string> = {
  pending: "Your account is waiting for approval.",
  blocked: "Your account is blocked. Contact an Admin for help.",
  unavailable:
    "We can’t verify account access right now. Please contact support.",
  "confirmation-error":
    "We couldn’t verify that link. Request a new confirmation email and try again.",
  "password-updated": "Your password was updated. Sign in with your new password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await redirectSignedInUser();
  const { notice } = await searchParams;

  return (
    <AuthLayout>
      <AuthForm mode="login" notice={notice ? notices[notice] ?? "" : ""} />
    </AuthLayout>
  );
}
