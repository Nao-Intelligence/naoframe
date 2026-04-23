import { redirect } from "next/navigation";
import { db, schema } from "./db";
import { createSupabaseServerClient } from "./supabase/server";
import { eq } from "drizzle-orm";

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);
  if (existing.length === 0) {
    await db
      .insert(schema.users)
      .values({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name ?? null,
      })
      .onConflictDoNothing();
  }

  return {
    id: user.id,
    email: user.email,
    name: (user.user_metadata?.name as string | null) ?? null,
  };
}

export async function requireAdminUser(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/login");
  return user;
}
