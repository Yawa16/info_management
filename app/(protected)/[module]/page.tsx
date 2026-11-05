import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/lib/auth/modules";
import { requireRight } from "@/lib/auth/permissions";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: slug } = await params;
  const moduleDef = getModule(slug);
  if (!moduleDef) {
    notFound();
  }

  await requireRight(moduleDef.key);

  return (
    <main className="erp-module-page">
      <h1>{moduleDef.label}</h1>
      <p>The {moduleDef.label} module screens are coming in a later task.</p>
      <Link className="erp-back" href="/dashboard">
        Back to Dashboard
      </Link>
    </main>
  );
}
