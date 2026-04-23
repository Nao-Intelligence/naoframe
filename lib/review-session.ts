import { cookies, headers } from "next/headers";
import { and, eq, isNull, or, gt } from "drizzle-orm";
import { db, schema } from "./db";

export type ResolvedShareLink = {
  shareLink: typeof schema.shareLinks.$inferSelect;
  project: typeof schema.projects.$inferSelect;
};

export async function resolveShareToken(
  token: string,
): Promise<ResolvedShareLink | null> {
  if (!token) return null;
  const rows = await db
    .select({
      shareLink: schema.shareLinks,
      project: schema.projects,
    })
    .from(schema.shareLinks)
    .innerJoin(schema.projects, eq(schema.shareLinks.projectId, schema.projects.id))
    .where(
      and(
        eq(schema.shareLinks.token, token),
        isNull(schema.shareLinks.revokedAt),
        or(
          isNull(schema.shareLinks.expiresAt),
          gt(schema.shareLinks.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

function sessionCookieName(shareLinkId: string): string {
  return `naoframe_rs_${shareLinkId.slice(0, 8)}`;
}

export async function getOrCreateReviewerSession(
  shareLinkId: string,
): Promise<typeof schema.reviewerSessions.$inferSelect> {
  const cookieStore = await cookies();
  const existingId = cookieStore.get(sessionCookieName(shareLinkId))?.value;

  if (existingId) {
    const existing = await db.query.reviewerSessions.findFirst({
      where: and(
        eq(schema.reviewerSessions.id, existingId),
        eq(schema.reviewerSessions.shareLinkId, shareLinkId),
      ),
    });
    if (existing) return existing;
  }

  const hdrs = await headers();
  const [row] = await db
    .insert(schema.reviewerSessions)
    .values({
      shareLinkId,
      userAgent: hdrs.get("user-agent") ?? null,
    })
    .returning();

  cookieStore.set(sessionCookieName(shareLinkId), row.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180 days
  });

  return row;
}

export async function getReviewerSession(
  shareLinkId: string,
): Promise<typeof schema.reviewerSessions.$inferSelect | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get(sessionCookieName(shareLinkId))?.value;
  if (!id) return null;
  return (
    (await db.query.reviewerSessions.findFirst({
      where: and(
        eq(schema.reviewerSessions.id, id),
        eq(schema.reviewerSessions.shareLinkId, shareLinkId),
      ),
    })) ?? null
  );
}
