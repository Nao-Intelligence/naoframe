import { and, eq } from "drizzle-orm";
import { db, schema } from "./db";
import {
  getOrCreateReviewerSession,
  resolveShareToken,
} from "./review-session";

export type ReviewerContext = {
  project: typeof schema.projects.$inferSelect;
  shareLink: typeof schema.shareLinks.$inferSelect;
  session: typeof schema.reviewerSessions.$inferSelect;
  story: typeof schema.userStories.$inferSelect;
};

export async function resolveReviewerContext(
  token: string,
  storyId: string,
): Promise<ReviewerContext | null> {
  const resolved = await resolveShareToken(token);
  if (!resolved) return null;

  const story = await db.query.userStories.findFirst({
    where: and(
      eq(schema.userStories.id, storyId),
      eq(schema.userStories.projectId, resolved.project.id),
    ),
  });
  if (!story) return null;

  const session = await getOrCreateReviewerSession(resolved.shareLink.id);
  return {
    project: resolved.project,
    shareLink: resolved.shareLink,
    session,
    story,
  };
}
