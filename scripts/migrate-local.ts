/**
 * Applies pending migrations to the local D1 database (`bun run db:migrate:local`).
 *
 * The `cf` beta applies the migrations and then never exits, so this runs it
 * in its own process group, watches the local database, and stops it once every
 * file in `migrations/` is recorded in `d1_migrations` and `cf` has gone quiet.
 * The exit code comes from that database check, not from `cf`.
 */
import { Database } from "bun:sqlite";
import { spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const DATABASE_ID = "00000000-0000-4000-8000-000000000000";
const STATE_DIR = ".wrangler/state";
const D1_DIR = path.join(STATE_DIR, "v3/d1/miniflare-D1DatabaseObject");
const MIGRATIONS_DIR = "migrations";
const TIME_LIMIT_MS = 120_000;
const QUIET_MS = 3_000;
const POLL_MS = 500;

/** Migration files that `d1_migrations` does not record yet, or null when no local database has that table. */
function findMissing(): Array<string> | null {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  let candidates: Array<string>;
  try {
    candidates = readdirSync(D1_DIR)
      .filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite")
      .map((name) => path.join(D1_DIR, name))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  } catch {
    return null;
  }
  for (const file of candidates) {
    const db = new Database(file, { readonly: true });
    try {
      const table = db
        .query("select 1 from sqlite_master where name = 'd1_migrations'")
        .get();
      if (table === null) continue;
      const rows = db.query("select name from d1_migrations").all() as Array<{
        name: string;
      }>;
      const applied = new Set(rows.map((row) => row.name));
      return files.filter((name) => !applied.has(name));
    } finally {
      db.close();
    }
  }
  return null;
}

const proc = spawn(
  "bunx",
  [
    "cf",
    "d1",
    "migrations",
    "apply",
    DATABASE_ID,
    "--local",
    "--persist-to",
    STATE_DIR,
  ],
  { stdio: ["ignore", "pipe", "pipe"], detached: true },
);

let lastOutput = Date.now();
let exited = false;
proc.on("exit", () => {
  exited = true;
});
proc.stdout.on("data", (chunk: Buffer) => {
  lastOutput = Date.now();
  process.stdout.write(chunk);
});
proc.stderr.on("data", (chunk: Buffer) => {
  lastOutput = Date.now();
  process.stderr.write(chunk);
});

function stopCf() {
  if (exited || proc.pid === undefined) return;
  try {
    process.kill(-proc.pid, "SIGKILL");
  } catch {
    proc.kill("SIGKILL");
  }
}

const startedAt = Date.now();
let missing: Array<string> | null = null;
while (true) {
  await sleep(POLL_MS);
  const finished = exited;
  missing = findMissing();
  if (finished) break;
  if (missing?.length === 0 && Date.now() - lastOutput > QUIET_MS) break;
  if (Date.now() - startedAt > TIME_LIMIT_MS) break;
}
stopCf();

if (missing === null) {
  console.error("No local D1 database with a d1_migrations table was found.");
  process.exit(1);
}
if (missing.length > 0) {
  console.error(
    `Migrations not applied:\n${missing.map((name) => `  ${name}`).join("\n")}`,
  );
  process.exit(1);
}
console.log("Local database is up to date.");
process.exit(0);
