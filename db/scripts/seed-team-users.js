const path = require("node:path");
const { createClient, repoRoot } = require("./lib");
const {
  createSupabaseAdmin,
  assertDevelopmentTarget,
  findOrCreateAuthUser,
  insertTeamAppUser,
  loadAuthUsers,
  readRoster,
} = require("./team-seed-lib");

async function main() {
  assertDevelopmentTarget("ALLOW_TEAM_SEED");
  const rosterPath = path.join(repoRoot, "db", "seeds", "team.csv");
  const roster = readRoster(rosterPath);
  const supabase = createSupabaseAdmin("DEV_SUPABASE_URL", "DEV_SUPABASE_SERVICE_ROLE_KEY");
  const authUsers = await loadAuthUsers(supabase);
  const resolvedUsers = [];
  for (const member of roster) {
    resolvedUsers.push({
      member,
      authUser: await findOrCreateAuthUser(supabase, authUsers, member),
    });
  }
  const client = createClient();
  await client.connect();

  let createdCount = 0;
  try {
    await client.query("BEGIN");
    for (const { member, authUser } of resolvedUsers) {
      const appUser = await insertTeamAppUser(client, authUser, member, "Superadmin", false);
      if (appUser.created) {
        createdCount += 1;
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log(`Team roster processed: ${roster.length}; new app_user rows: ${createdCount}.`);
  console.log("New accounts have no local password hash and require first-time password setup.");
}

main().catch((error) => {
  console.error(`Team account seed failed: ${error.message}`);
  process.exitCode = 1;
});
