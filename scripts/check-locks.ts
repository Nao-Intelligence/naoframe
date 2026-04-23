import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) process.exit(2);
  const sql = postgres(url, { prepare: false, max: 1, ssl: "require" });

  const rows = await sql`
    select pid, usename, state, wait_event_type, wait_event,
           now() - query_start as age, left(query, 200) as query
    from pg_stat_activity
    where state != 'idle' and pid <> pg_backend_pid()
    order by query_start asc
  `;
  for (const r of rows) console.log(r);
  await sql.end();
}
main();
