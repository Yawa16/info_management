import Link from "next/link";

export const metadata = {
  title: "Password set | Hope, Inc.",
  robots: { index: false, follow: false },
};

export default function PasswordSetupCompletePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          Hope, Inc.
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">Password set</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Your password has been set. You can now sign in with your new password.
        </p>
        <Link
          className="mt-7 inline-block rounded-lg bg-teal-800 px-4 py-3 font-semibold text-white hover:bg-teal-900"
          href="/sign-in"
        >
          Continue to sign in
        </Link>
      </section>
    </main>
  );
}
