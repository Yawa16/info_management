import Link from "next/link";

type AuthPlaceholderProps = {
  title: string;
};

export function AuthPlaceholder({ title }: AuthPlaceholderProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          Hope, Inc.
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 leading-7 text-slate-600">
          This page is ready for the Supabase authentication flow.
        </p>
        <Link
          href="/"
          className="mt-7 inline-block text-sm font-semibold text-teal-800 hover:text-teal-900"
        >
          Back to home
        </Link>
      </section>
    </main>
  );
}
