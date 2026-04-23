import "dotenv/config";
import postgres from "postgres";

function redact(u: string): string {
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.username}:***@${parsed.hostname}:${parsed.port || "(default)"}${parsed.pathname}`;
  } catch {
    return "<unparseable>";
  }
}

function inspectPassword(u: string): string {
  try {
    const parsed = new URL(u);
    const pwd = parsed.password;
    if (!pwd) return "no password in URL";
    const decoded = decodeURIComponent(pwd);
    // Character-class profile (no content leaked):
    const counts = {
      letters: 0,
      digits: 0,
      space: 0,
      bracket: 0,
      percent: 0,
      other: 0,
    };
    for (const c of decoded) {
      if (/[A-Za-z]/.test(c)) counts.letters++;
      else if (/[0-9]/.test(c)) counts.digits++;
      else if (c === " ") counts.space++;
      else if (c === "[" || c === "]") counts.bracket++;
      else if (c === "%") counts.percent++;
      else counts.other++;
    }
    return [
      `raw=${pwd.length}`,
      `decoded=${decoded.length}`,
      `letters=${counts.letters}`,
      `digits=${counts.digits}`,
      `space=${counts.space}`,
      `bracket=${counts.bracket}`,
      `percent=${counts.percent}`,
      `other=${counts.other}`,
    ].join(", ");
  } catch {
    return "<could not parse>";
  }
}

function extractProjectRef(connectionString: string | undefined): string | null {
  if (!connectionString) return null;
  try {
    const p = new URL(connectionString);
    // Session/transaction pooler username format: postgres.<project-ref>
    if (p.username.startsWith("postgres.")) {
      return p.username.substring("postgres.".length);
    }
    // Direct: db.<ref>.supabase.co
    const m = p.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
}

function extractSupabaseUrlRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const p = new URL(url);
    const m = p.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function probe(label: string, url: string | undefined) {
  console.log(`\n— ${label} —`);
  if (!url) {
    console.log("not set");
    return;
  }
  console.log("URL:", redact(url));
  console.log("Password:", inspectPassword(url));
  console.log("Project ref from URL:", extractProjectRef(url));

  const sql = postgres(url, {
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    max: 1,
    ssl: "require",
  });
  try {
    const rows = await sql`select version()`;
    console.log("OK —", rows[0].version);
  } catch (err) {
    console.log("FAIL:", err instanceof Error ? err.message : String(err));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  console.log("NEXT_PUBLIC_SUPABASE_URL ref:", extractSupabaseUrlRef(process.env.NEXT_PUBLIC_SUPABASE_URL));
  await probe("DATABASE_URL", process.env.DATABASE_URL);
  await probe("DIRECT_DATABASE_URL", process.env.DIRECT_DATABASE_URL);
}

main();
