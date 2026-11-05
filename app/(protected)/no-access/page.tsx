import Link from "next/link";

export default function NoAccessPage() {
  return (
    <main className="erp-module-page">
      <h1>No access</h1>
      <p>
        You do not have permission to open that page. If you need it, ask an
        Admin to grant you the right.
      </p>
      <Link className="erp-back" href="/dashboard">
        Back to Dashboard
      </Link>
    </main>
  );
}
