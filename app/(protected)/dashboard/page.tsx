import Link from "next/link";
import { signOutUser } from "@/lib/actions/auth";

export default function DashboardPage() {
  return (
    <main className="container" style={{ paddingBlock: "4rem" }}>
      <h1>Welcome to Hope.</h1>
      <p>Your account is approved and ready to use.</p>
      <p>
        <Link href="/users">Manage pending User approvals</Link>
      </p>
      <form action={signOutUser}>
        <button className="button button-dark" type="submit">
          Sign out
        </button>
      </form>
    </main>
  );
}
