import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPasswordPage() {
  return <AuthLayout><AuthForm mode="reset" /></AuthLayout>;
}
