import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) process.exit(2);
  const sql = postgres(url, { prepare: false, max: 1, ssl: "require" });

  // Terminate any backend that's been stuck >30s in an idle-ish state and is
  // NOT our current one — these are almost always abandoned pool connections
  // blocking ALTER TABLE.
  const rows = await sql`
    select pid, pg_terminate_backend(pid) as terminated
    from pg_stat_activity
    where pid <> pg_backend_pid()
      and state in ('active', 'idle in transaction', 'idle in transaction (aborted)')
      and now() - state_change > interval '30 seconds'
  `;
  console.log("Terminated:", rows);
  await sql.end();
}
main();
