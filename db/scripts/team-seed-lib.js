const fs = require("node:fs");
const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
const { databaseUrl, hostIsAllowedForReset } = require("./lib");

function assertDevelopmentTarget(confirmationVariable) {
  if (process.env.NODE_ENV === "production" || process.env[confirmationVariable] !== "true") {
    throw new Error(
      `Refusing account seed: set ${confirmationVariable}=true only for a development database.`,
    );
  }
  const target = databaseUrl();
  const expectedName = process.env.DEV_DATABASE_NAME;
  if (!expectedName || target.database !== expectedName) {
    throw new Error("Refusing account seed: database name must exactly match DEV_DATABASE_NAME.");
  }
  if (!hostIsAllowedForReset(target.host)) {
    throw new Error(
      "Refusing account seed: host must be localhost or an exact DEV_ALLOWED_HOSTS entry.",
    );
  }
}

function parseCsvRow(line, lineNumber) {
  const cells = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        cell += character;
      }
    } else if (character === "," && !closedQuote) {
      cells.push(cell.trim());
      cell = "";
      closedQuote = false;
    } else if (character === '"' && cell.length === 0 && !closedQuote) {
      quoted = true;
    } else if (closedQuote && character !== " " && character !== "\t") {
      throw new Error(`Invalid CSV syntax on line ${lineNumber}.`);
    } else {
      cell += character;
    }
  }

  if (quoted) {
    throw new Error(`Unclosed quoted field on line ${lineNumber}.`);
  }
  cells.push(cell.trim());
  return cells;
}

function readRoster(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Team roster not found. Copy db/seeds/team.example.csv to ${filePath} and replace it locally.`,
    );
  }

  const lines = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = parseCsvRow(lines.shift() || "", 1).map((value) => value.toLowerCase());
  if (header.join(",") !== "first_name,last_name,email") {
    throw new Error("Team roster header must be: first_name,last_name,email.");
  }

  const roster = [];
  const emails = new Set();
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) {
      continue;
    }
    const values = parseCsvRow(line, index + 2);
    if (values.length !== 3 || values.some((value) => !value)) {
      throw new Error(`Team roster line ${index + 2} must contain first name, last name, and email.`);
    }
    const [firstName, lastName, rawEmail] = values;
    const email = rawEmail.toLowerCase();
    if (firstName.length > 100 || lastName.length > 100 || email.length > 254) {
      throw new Error(`Team roster line ${index + 2} exceeds the supported field length.`);
    }
    if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email)) {
      throw new Error(`Invalid email address in team roster line ${index + 2}.`);
    }
    if (emails.has(email)) {
      throw new Error(`Duplicate email address in team roster line ${index + 2}.`);
    }
    emails.add(email);
    roster.push({ firstName, lastName, email });
  }

  if (roster.length === 0) {
    throw new Error("Team roster has no members.");
  }
  return roster;
}

function createSupabaseAdmin(
  urlName = "NEXT_PUBLIC_SUPABASE_URL",
  keyName = "SUPABASE_SERVICE_ROLE_KEY",
) {
  const url = process.env[urlName];
  const serviceRoleKey = process.env[keyName];
  if (!url || !serviceRoleKey) {
    throw new Error(`${urlName} and ${keyName} are required.`);
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`${urlName} must be a valid Supabase project URL.`);
  }
  if (!["https:", "http:"].includes(parsedUrl.protocol)
    || parsedUrl.pathname !== "/"
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.search
    || parsedUrl.hash
    || (parsedUrl.protocol === "http:"
      && !["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname))) {
    throw new Error(`${urlName} must be a Supabase project origin.`);
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadAuthUsers(supabase) {
  const usersByEmail = new Map();
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Could not read Supabase Auth users: ${error.message}`);
    }
    for (const user of data.users) {
      if (user.email) {
        usersByEmail.set(user.email.toLowerCase(), user);
      }
    }
    if (data.users.length < perPage) {
      return usersByEmail;
    }
  }
}

async function findOrCreateAuthUser(supabase, usersByEmail, member) {
  const existing = usersByEmail.get(member.email);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: member.email,
    email_confirm: true,
    user_metadata: {
      first_name: member.firstName,
      last_name: member.lastName,
    },
  });
  if (error) {
    throw new Error(`Could not provision Supabase Auth account for ${member.email}: ${error.message}`);
  }
  usersByEmail.set(member.email, data.user);
  return data.user;
}

async function insertTeamAppUser(client, authUser, member, roleName, updateExisting) {
  const result = await client.query(
    `INSERT INTO public.app_user (
       auth_user_id, first_name, last_name, email, password_hash, role_id,
       approval_status, must_set_password, status, is_blocked
     )
     SELECT $1, $2, $3, $4, NULL, role.id, 'approved', TRUE, 'Active', FALSE
     FROM public.role AS role
     WHERE role.name = $5 AND role.status = 'Active'
     ON CONFLICT (auth_user_id) DO ${
       updateExisting
         ? `UPDATE SET
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              email = EXCLUDED.email,
              password_hash = NULL,
              role_id = EXCLUDED.role_id,
              approval_status = 'approved',
              must_set_password = TRUE,
              status = 'Active',
              is_blocked = FALSE`
         : "NOTHING"
     }
     RETURNING id`,
    [authUser.id, member.firstName, member.lastName, member.email, roleName],
  );
  if (result.rowCount !== 1) {
    const existing = await client.query(
      `SELECT app_user.id,
              app_user.auth_user_id,
              lower(app_user.email) AS email,
              role.name AS role_name
       FROM public.app_user AS app_user
       LEFT JOIN public.role AS role ON role.id = app_user.role_id
       WHERE app_user.auth_user_id = $1 OR lower(app_user.email) = $2`,
      [authUser.id, member.email],
    );
    if (existing.rowCount > 1
      || (existing.rowCount && existing.rows[0].auth_user_id !== authUser.id)) {
      throw new Error(`Email ${member.email} is already linked to a different Auth identity.`);
    }
    if (existing.rowCount === 0) {
      throw new Error(`Active ${roleName} role is missing; run the catalogue seed first.`);
    }
    if (existing.rows[0].email !== member.email) {
      throw new Error(`Roster email ${member.email} does not match the existing app_user email.`);
    }
    if (!updateExisting && existing.rows[0].role_name !== roleName) {
      throw new Error(`Existing account ${member.email} is not assigned the ${roleName} role.`);
    }
    return { id: existing.rows[0].id, created: false };
  }
  return { id: result.rows[0].id, created: true };
}

module.exports = {
  assertDevelopmentTarget,
  createSupabaseAdmin,
  findOrCreateAuthUser,
  insertTeamAppUser,
  loadAuthUsers,
  readRoster,
};
