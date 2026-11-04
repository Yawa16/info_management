const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const {
  createClient,
  databaseUrl,
  hostIsAllowedForReset,
  repoRoot,
} = require("./lib");

const expectedProjectRef = "a development Supabase project";

function assertDevelopmentTarget() {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_AUDIT_TEST !== "true") {
    throw new Error(
      "Refusing audit verification: set ALLOW_AUDIT_TEST=true only for a development database.",
    );
  }

  const database = databaseUrl();
  const expectedName = process.env.DEV_DATABASE_NAME;
  if (!expectedName || database.database !== expectedName) {
    throw new Error("Refusing audit verification: database must match DEV_DATABASE_NAME.");
  }
  if (!hostIsAllowedForReset(database.host)) {
    throw new Error("Refusing audit verification: database host is not allowlisted for development.");
  }

  const apiUrl = process.env.DEV_SUPABASE_URL;
  if (!apiUrl) {
    throw new Error("DEV_SUPABASE_URL is required to verify the development database target.");
  }
  const projectRef = new URL(apiUrl).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
  const poolerRef = decodeURIComponent(new URL(database.value).username)
    .match(/(?:^|\.)([a-z0-9-]{15,})$/i)?.[1];
  const directRef = new URL(database.value).hostname
    .match(/^db\.([a-z0-9-]+)\.supabase\.co$/i)?.[1];
  if (!projectRef || (directRef || poolerRef) !== projectRef) {
    throw new Error(`Refusing audit verification: database and Auth project do not match ${expectedProjectRef}.`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyTransactionLocalSetting(client) {
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query(
      "SELECT set_config('app.current_user', $1, true)",
      ["first-transaction@hope.test"],
    );
    const first = await client.query("SELECT public.audit_user() AS app_user");
    assert(
      first.rows[0].app_user === "first-transaction@hope.test",
      "transaction-local identity was not visible in its transaction",
    );
    await client.query("COMMIT");
    transactionOpen = false;

    await client.query("BEGIN");
    transactionOpen = true;
    const next = await client.query(
      "SELECT public.audit_user() AS app_user, current_setting('app.current_user', true) AS setting",
    );
    assert(
      next.rows[0].app_user === "system"
        && (next.rows[0].setting === null || next.rows[0].setting === ""),
      "previous transaction's application identity leaked into a new transaction",
    );
    await client.query("ROLLBACK");
    transactionOpen = false;
    console.log("PASS: 5. committed transaction-local user does not leak");
  } catch (error) {
    if (transactionOpen) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    console.error(`FAIL: 5. committed transaction-local user does not leak - ${error.message}`);
    return false;
  }
  return true;
}

async function verifyIndependentSessions() {
  const clients = [createClient(), createClient()];
  const users = ["session-one@hope.test", "session-two@hope.test"];
  const keys = users.map((_, index) =>
    `S${index}${require("node:crypto").randomBytes(8).toString("hex")}`.slice(0, 10),
  );
  const begun = [false, false];
  try {
    await Promise.all(clients.map((client) => client.connect()));
    await Promise.all(clients.map(async (client, index) => {
      await client.query("BEGIN");
      begun[index] = true;
    }));
    await Promise.all(clients.map((client, index) =>
      client.query("SELECT set_config('app.current_user', $1, true)", [users[index]]),
    ));
    await Promise.all(clients.map((client, index) =>
      client.query(
        `INSERT INTO public.customer (cust_no, cust_name, stamp)
         VALUES ($1, $2, 'caller-supplied')`,
        [keys[index], "Audit session fixture"],
      ),
    ));

    const audits = await Promise.all(clients.map((client, index) =>
      client.query(
        `SELECT app_user, action, new_values ->> 'stamp' AS stamp
         FROM public.audit_log
         WHERE table_name = 'customer'
           AND record_key = jsonb_build_object('cust_no', $1)::TEXT
         ORDER BY id DESC
         LIMIT 1`,
        [keys[index]],
      ),
    ));
    for (let index = 0; index < clients.length; index += 1) {
      assert(
        audits[index].rowCount === 1
          && audits[index].rows[0].app_user === users[index]
          && audits[index].rows[0].action === "CREATED"
          && audits[index].rows[0].stamp.startsWith(`CREATED ${users[index]} `),
        `session ${index + 1} did not record its own application user`,
      );
    }

    await Promise.all(clients.map(async (client, index) => {
      await client.query("ROLLBACK");
      begun[index] = false;
    }));
    console.log("PASS: 6. simultaneous transactions in separate sessions record their own users");
    return true;
  } catch (error) {
    console.error(`FAIL: 6. simultaneous transactions in separate sessions record their own users - ${error.message}`);
    return false;
  } finally {
    await Promise.all(clients.map(async (client, index) => {
      if (begun[index]) {
        try { await client.query("ROLLBACK"); } catch {}
      }
      try { await client.end(); } catch {}
    }));
  }
}

async function main() {
  assertDevelopmentTarget();

  const sqlPath = path.join(repoRoot, "db", "verification", "verify_audit_user.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = createClient();
  let serialPassed = true;
  try {
    client.on("notice", (notice) => {
      const message = notice.message || "";
      if (message.startsWith("PASS:")) {
        console.log(message);
      } else if (message.startsWith("FAIL:")) {
        console.error(message);
        serialPassed = false;
      }
    });
    await client.connect();
    try {
      await client.query(sql);
    } catch (error) {
      serialPassed = false;
      console.error(`Serial audit SQL checks failed: ${error.message}`);
      try { await client.query("ROLLBACK"); } catch {}
    }
  } finally {
    await client.end();
  }

  const sessionClient = createClient();
  let localSettingPassed = false;
  try {
    await sessionClient.connect();
    localSettingPassed = await verifyTransactionLocalSetting(sessionClient);
  } finally {
    await sessionClient.end();
  }
  const sessionsPassed = await verifyIndependentSessions();

  if (!serialPassed || !localSettingPassed || !sessionsPassed) {
    throw new Error("One or more audit-user verification cases failed.");
  }
  console.log("All Task 6 audit verification cases passed; test transactions were rolled back.");
}

main().catch((error) => {
  console.error(`Audit verification failed: ${error.message}`);
  process.exitCode = 1;
});
