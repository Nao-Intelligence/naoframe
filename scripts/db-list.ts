import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) process.exit(2);

  const sql = postgres(url, { prepare: false, max: 1, ssl: "require" });

  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `;
  console.log("Tables:");
  for (const t of tables) console.log(" -", t.table_name);

  await sql.end();
}

main();
