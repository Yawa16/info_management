import Link from "next/link";
import { isSetupTokenValid } from "@/lib/auth/password-setup";
import { PasswordSetupForm } from "./password-setup-form";

export const metadata = {
  title: "Set your password | Hope, Inc.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type SetPasswordPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  let valid = false;
  let unavailable = false;
  try {
    valid = await isSetupTokenValid(token);
  } catch (error) {
    unavailable = true;
    console.error(
      "First-password token lookup failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          Hope, Inc.
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">Set your password</h1>
        {valid ? (
          <>
            <p className="mt-3 leading-7 text-slate-600">
              Choose a new password to activate your account. Use at least 12 characters.
            </p>
            <PasswordSetupForm token={token} />
          </>
        ) : (
          <>
            <p className="mt-3 leading-7 text-slate-600" role="status">
              {unavailable
                ? "Password setup is temporarily unavailable. Try again later."
                : "This setup link is invalid, expired, or has already been used. Request a new link from your administrator."}
            </p>
            <Link
              className="mt-7 inline-block text-sm font-semibold text-teal-800 hover:text-teal-900"
              href="/"
            >
              Back to home
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
