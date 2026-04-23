import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as schema from "@/drizzle/schema";

const globalForDb = globalThis as unknown as {
  __naoframe_pg?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__naoframe_pg ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    max: 10,
    ssl: "require",
  });

if (process.env.NODE_ENV !== "production") globalForDb.__naoframe_pg = client;

export const db = drizzle(client, { schema });
export { schema };
