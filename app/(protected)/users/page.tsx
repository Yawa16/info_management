import { redirect } from "next/navigation";
import ApproveUserForm from "@/components/ApproveUserForm";
import BlockManagedUserForm from "@/components/BlockManagedUserForm";
import CreateManagedUserForm from "@/components/CreateManagedUserForm";
import EditManagedUserForm from "@/components/EditManagedUserForm";
import ManageUserRoleForm from "@/components/ManageUserRoleForm";
import RightsDialog from "@/components/RightsDialog";
import { getProfileAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ManagedProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  approval_status: string;
  is_blocked: boolean;
};

function displayStatus(profile: ManagedProfile) {
  if (profile.is_blocked) return "Blocked";
  if (profile.approval_status === "pending") return "Pending";
  if (profile.approval_status === "rejected") return "Rejected";
  return "Active";
}

export default async function UsersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Unable to verify access to User Management.", authError);
  }
  if (!user) {
    redirect("/login");
  }

  const access = await getProfileAccess(user.id);
  if (
    access.status !== "approved" ||
    (access.role !== "admin" && access.role !== "superadmin")
  ) {
    redirect("/dashboard");
  }

  const adminClient = createSupabaseAdminClient();
  let usersQuery = adminClient
    .from("profiles")
    .select(
      "id, first_name, last_name, email, role, approval_status, is_blocked",
    )
    .order("first_name");

  if (access.role === "admin") {
    usersQuery = usersQuery.neq("role", "superadmin");
  }

  const [{ data: users, error: usersError }, pendingResult] = await Promise.all([
    usersQuery,
    access.role === "superadmin"
      ? adminClient
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("role", "user")
          .eq("approval_status", "pending")
          .order("first_name")
      : Promise.resolve({ data: null, error: null }),
  ]);
  const pendingUsers = pendingResult.data;
  const pendingError = pendingResult.error;

  if (usersError) {
    console.error("Unable to load managed user accounts.", {
      code: usersError.code,
      message: usersError.message,
    });
  }
  if (pendingError) {
    console.error("Unable to load pending user accounts.", {
      code: pendingError.code,
      message: pendingError.message,
    });
  }
  return (
    <main className="container user-management-page">
      <header className="user-management-header">
        <div>
          <p className="eyebrow">HOPE, INC. ERP</p>
          <h1>User Management</h1>
          <p>Manage accounts, access status, and pending approvals.</p>
        </div>
        <CreateManagedUserForm />
      </header>

      <section className="user-management-section" aria-labelledby="accounts-title">
        <div className="user-section-heading">
          <div>
            <h2 id="accounts-title">Accounts</h2>
            <p>
              {access.role === "admin"
                ? "Superadmin accounts are not shown."
                : "Manage all accounts in the system."}
            </p>
          </div>
          <span className="user-count">{users?.length ?? 0} accounts</span>
        </div>

        {usersError ? (
          <p className="user-load-error" role="alert">
            We couldn’t load accounts. Please refresh or contact support.
          </p>
        ) : users?.length ? (
          <div className="user-table-scroll">
            <table className="user-management-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(users as ManagedProfile[]).map((managedUser) => {
                  const isSelf = managedUser.id === user.id;
                  const canManage =
                    !isSelf &&
                    (access.role === "superadmin" ||
                      managedUser.role === "user");

                  return (
                    <tr key={managedUser.id}>
                      <td data-label="Name">
                        {managedUser.first_name} {managedUser.last_name}
                      </td>
                      <td data-label="Email">{managedUser.email}</td>
                      <td data-label="Role">
                        <span className={`user-role-badge role-${managedUser.role}`}>
                          {managedUser.role}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`user-status-badge status-${displayStatus(managedUser).toLowerCase()}`}
                        >
                          {displayStatus(managedUser)}
                        </span>
                      </td>
                      <td data-label="Actions">
                        {canManage ? (
                          <div className="user-row-actions">
                            <BlockManagedUserForm
                              userId={managedUser.id}
                              isBlocked={managedUser.is_blocked}
                            />
                            {managedUser.role === "user" &&
                              ["active", "approved"].includes(
                                managedUser.approval_status,
                              ) && (
                                <RightsDialog
                                  userId={managedUser.id}
                                  userName={
                                    `${managedUser.first_name ?? ""} ${managedUser.last_name ?? ""}`.trim() ||
                                    managedUser.email
                                  }
                                />
                              )}
                            <EditManagedUserForm user={managedUser} />
                            {access.role === "superadmin" &&
                              !managedUser.is_blocked &&
                              ["active", "approved"].includes(
                                managedUser.approval_status,
                              ) &&
                              (managedUser.role === "admin" ||
                                managedUser.role === "user") && (
                                <ManageUserRoleForm
                                  userId={managedUser.id}
                                  role={managedUser.role}
                                />
                              )}
                          </div>
                        ) : (
                          <span aria-label="No actions available">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="user-empty-state">No accounts found.</p>
        )}
      </section>

      {access.role === "superadmin" && (
        <section
          className="user-management-section"
          aria-labelledby="pending-title"
        >
          <div className="user-section-heading">
            <div>
              <h2 id="pending-title">Pending approvals</h2>
              <p>
                Approve or reject regular User registrations before they can
                access the ERP.
              </p>
            </div>
            <span className="user-count">
              {pendingUsers?.length ?? 0} pending
            </span>
          </div>
          {pendingError ? (
            <p className="user-load-error" role="alert">
              We couldn’t load pending accounts. Please refresh or contact
              support.
            </p>
          ) : pendingUsers?.length ? (
            <ul className="user-pending-list">
              {pendingUsers.map((pendingUser) => (
                <li key={pendingUser.id}>
                  <span>
                    {pendingUser.first_name} {pendingUser.last_name}
                    <small>{pendingUser.email}</small>
                  </span>
                  <ApproveUserForm userId={pendingUser.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="user-empty-state">No pending User accounts.</p>
          )}
        </section>
      )}

    </main>
  );
}
