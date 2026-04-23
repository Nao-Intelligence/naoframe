import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL / DIRECT_DATABASE_URL");
  process.exit(2);
}

const MIGRATIONS_DIR = "drizzle/migrations";

async function main() {
  const sql = postgres(url!, {
    prepare: false,
    max: 1,
    ssl: "require",
  });

  // Terminate any other long-running backends that may be holding locks on
  // our tables — dev-server connections can otherwise block ALTER TABLE.
  try {
    await sql`
      select pg_terminate_backend(pid)
      from pg_stat_activity
      where pid <> pg_backend_pid()
        and datname = current_database()
        and state is not null
        and now() - state_change > interval '10 seconds'
    `;
  } catch (err) {
    console.warn("Could not clean up stale backends:", err instanceof Error ? err.message : err);
  }

  await sql`
    create table if not exists drizzle_migrations (
      id serial primary key,
      name text not null unique,
      applied_at timestamptz not null default now()
    )
  `;
  const applied = new Set(
    (await sql`select name from drizzle_migrations`).map((r) => r.name),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log("  skip", file, "(already applied)");
      continue;
    }
    console.log("→ applying", file);
    const contents = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const statements = contents
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }
    await sql`insert into drizzle_migrations (name) values (${file})`;
    console.log("  ok");
  }

  await sql.end({ timeout: 5 });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
