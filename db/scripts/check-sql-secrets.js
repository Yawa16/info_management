const { spawnSync } = require("node:child_process");

const forbiddenPatterns = [
  {
    name: "bcrypt/Argon2 hash",
    pattern: /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}|\$argon2(?:id|i|d)\$[^$\s]+\$[^$\s]+\$[A-Za-z0-9+/]+={0,2}/i,
  },
  { name: "password assignment", pattern: /\bpassword\s*=/i },
];

function findForbiddenPattern(contents) {
  return forbiddenPatterns.find(({ pattern }) => pattern.test(contents))?.name || null;
}

function git(args, encoding = "utf8") {
  const result = spawnSync("git", args, { encoding });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args[0]} failed.`);
  }
  return result.stdout;
}

function main() {
  const stagedPaths = git([
    "diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z", "--", "*.sql",
  ], "buffer")
    .toString("utf8")
    .split("\0")
    .filter(Boolean);

  const failures = [];
  for (const filePath of stagedPaths) {
    const stagedContents = git(["show", `:${filePath}`]);
    const finding = findForbiddenPattern(stagedContents);
    if (finding) {
      failures.push({ filePath, finding });
    }
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(`${failure.filePath}: contains a forbidden ${failure.finding}.`);
    }
    console.error("Remove the credential/hash from staged SQL before committing.");
    process.exitCode = 1;
    return;
  }
  console.log(`SQL credential check passed (${stagedPaths.length} staged SQL file(s)).`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`SQL credential check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { findForbiddenPattern };
