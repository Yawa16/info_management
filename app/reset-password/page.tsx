import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

const notices: Record<string, string> = {
  "invalid-link": "This reset link is invalid or expired. Request a new one.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;

  return (
    <AuthLayout>
      <AuthForm
        mode="reset"
        notice={notice ? notices[notice] ?? "" : ""}
      />
    </AuthLayout>
  );
}
