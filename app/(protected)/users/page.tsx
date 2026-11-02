import { redirect } from "next/navigation";
import ApproveUserForm from "@/components/ApproveUserForm";
import { getProfileAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function UsersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Unable to verify access to user approvals.", authError);
  }

  if (!user) {
    redirect("/login");
  }

  const access = await getProfileAccess(user.id);
  if (
    access.status !== "approved" ||
    !["admin", "superadmin"].includes(access.role ?? "")
  ) {
    redirect("/dashboard");
  }

  const adminClient = createSupabaseAdminClient();
  const { data: pendingUsers, error } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("role", "user")
    .eq("approval_status", "pending")
    .order("first_name");

  if (error) {
    console.error("Unable to load pending user accounts.", {
      code: error.code,
      message: error.message,
    });

    return (
      <main className="container" style={{ paddingBlock: "4rem" }}>
        <h1>Pending user approvals</h1>
        <p role="alert">
          We couldn’t load pending accounts. Please try again or contact
          support.
        </p>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingBlock: "4rem" }}>
      <h1>Pending user approvals</h1>
      <p>Admins and Superadmins can approve regular User accounts.</p>
      {pendingUsers?.length ? (
        <ul>
          {pendingUsers.map((pendingUser) => (
            <li
              key={pendingUser.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                paddingBlock: "1rem",
                borderBottom: "1px solid #e2e6df",
              }}
            >
              <span>
                {pendingUser.first_name} {pendingUser.last_name} —{" "}
                {pendingUser.email}
              </span>
              <ApproveUserForm userId={pendingUser.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p>No pending User accounts.</p>
      )}
    </main>
  );
}
