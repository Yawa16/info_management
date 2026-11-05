import Link from "next/link";
import { requireManager } from "@/lib/auth/permissions";

export default async function SystemSettingsPage() {
  await requireManager(true);

  return (
    <main className="erp-module-page">
      <h1>System Settings</h1>
      <p>System-wide settings for the Superadmin will be added in a later task.</p>
      <Link className="erp-back" href="/dashboard">
        Back to Dashboard
      </Link>
    </main>
  );
}
