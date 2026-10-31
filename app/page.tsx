import Link from "next/link";
import { AuthLinks } from "@/components/auth-links";

const modules = ["Customers", "Products", "Human Resources", "Sales", "Reports"];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          Hope, Inc.
        </Link>
        <AuthLinks />
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-24">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Hope, Inc. ERP
          </p>
          <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight text-slate-950 md:text-6xl">
            Run your business with clarity.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            A single place to manage your customers, products, people, and
            day-to-day operations.
          </p>
          <div className="mt-9">
            <AuthLinks prominent />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">
          <p className="text-sm font-semibold text-slate-500">ONE WORKSPACE</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Everything in view
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {modules.map((module) => (
              <li
                key={module}
                className="rounded-xl bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700"
              >
                {module}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-6 text-center text-sm text-slate-500">
        Hope, Inc. business management
      </footer>
    </main>
  );
}
