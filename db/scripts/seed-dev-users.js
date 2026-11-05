const { createClient } = require("./lib");
const {
  assertDevelopmentTarget,
  createSupabaseAdmin,
  findOrCreateAuthUser,
  insertTeamAppUser,
  loadAuthUsers,
} = require("./team-seed-lib");

const devUsers = [
  { firstName: "Lisa", lastName: "Park", email: "lisa.park@example.test", role: "Admin" },
  { firstName: "Alex", lastName: "Rivera", email: "alex.rivera@example.test", role: "User" },
];

async function main() {
  assertDevelopmentTarget("ALLOW_DEV_SEED");
  const supabase = createSupabaseAdmin("DEV_SUPABASE_URL", "DEV_SUPABASE_SERVICE_ROLE_KEY");
  const authUsers = await loadAuthUsers(supabase);
  const resolvedUsers = [];
  for (const member of devUsers) {
    resolvedUsers.push({
      member,
      authUser: await findOrCreateAuthUser(supabase, authUsers, member),
    });
  }
  const client = createClient();
  await client.connect();

  let usersByRole;
  try {
    await client.query("BEGIN");
    usersByRole = {};
    for (const { member, authUser } of resolvedUsers) {
      const appUser = await insertTeamAppUser(client, authUser, member, member.role, true);
      usersByRole[member.role] = appUser.id;
    }

    const reportRight = await client.query(
      "SELECT id FROM public.rights WHERE code = 'REPORT_TOP_CUSTOMERS' AND status = 'Active'",
    );
    const customerRight = await client.query(
      "SELECT id FROM public.rights WHERE code = 'CUSTOMER_ADD' AND status = 'Active'",
    );
    const productRight = await client.query(
      "SELECT id FROM public.rights WHERE code = 'PRODUCT_ADD' AND status = 'Active'",
    );
    if (!reportRight.rowCount || !customerRight.rowCount || !productRight.rowCount) {
      throw new Error("Required Task 5 rights are missing; run the catalogue seed first.");
    }

    await client.query(
      `INSERT INTO public.user_permission (user_id, right_id, granted_by, status)
       VALUES ($1, $2, $3, 'Active'), ($1, $4, $3, 'Active'), ($1, $5, $3, 'Active')
       ON CONFLICT (user_id, right_id) DO UPDATE
       SET granted_by = EXCLUDED.granted_by,
           granted_at = CURRENT_TIMESTAMP,
           status = 'Active',
           stamp = 'EDITED dev-seed ' ||
             to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM')`,
      [
        usersByRole.User,
        customerRight.rows[0].id,
        usersByRole.Admin,
        productRight.rows[0].id,
        reportRight.rows[0].id,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log("Development-only Admin and User accounts seeded with three sample rights.");
  console.log("Run the setup-link command separately to print their one-time password setup links.");
}

main().catch((error) => {
  console.error(`Development account seed failed: ${error.message}`);
  process.exitCode = 1;
});
