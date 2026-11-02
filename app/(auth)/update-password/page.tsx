import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

export default function UpdatePasswordPage() {
  return (
    <AuthLayout>
      <AuthForm mode="update" />
    </AuthLayout>
  );
}
