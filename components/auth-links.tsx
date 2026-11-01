import Link from "next/link";

type AuthLinksProps = {
  prominent?: boolean;
};

export function AuthLinks({ prominent = false }: AuthLinksProps) {
  const linkClass = prominent
    ? "rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    : "rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100";

  return (
    <nav aria-label="Account" className="flex items-center gap-3">
      <Link href="/sign-in" className={linkClass}>
        Sign In
      </Link>
      <Link
        href="/register"
        className="rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
      >
        Register
      </Link>
    </nav>
  );
}
