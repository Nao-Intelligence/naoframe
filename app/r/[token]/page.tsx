import { notFound, redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  getReviewerSession,
  resolveShareToken,
} from "@/lib/review-session";
import { resolveWireframeBaseUrl } from "@/lib/wireframe";
import { ReviewShell } from "@/components/reviewer/ReviewShell";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ story?: string }>;
}) {
  const { token } = await params;
  const { story: initialStoryId } = await searchParams;

  const resolved = await resolveShareToken(token);
  if (!resolved) notFound();

  const session = await getReviewerSession(resolved.shareLink.id);
  if (!session) {
    const qs = initialStoryId ? `?story=${encodeURIComponent(initialStoryId)}` : "";
    redirect(`/r/${token}/init${qs}`);
  }

  const stories = await db
    .select()
    .from(schema.userStories)
    .where(eq(schema.userStories.projectId, resolved.project.id))
    .orderBy(asc(schema.userStories.orderIndex), asc(schema.userStories.createdAt));

  const decisions = await db
    .select()
    .from(schema.storyDecisions)
    .where(eq(schema.storyDecisions.reviewerSessionId, session.id))
    .orderBy(desc(schema.storyDecisions.decidedAt));

  const feedback = await db
    .select()
    .from(schema.feedbackEntries)
    .where(eq(schema.feedbackEntries.reviewerSessionId, session.id))
    .orderBy(desc(schema.feedbackEntries.createdAt));

  return (
    <ReviewShell
      token={token}
      project={{
        id: resolved.project.id,
        name: resolved.project.name,
        clientName: resolved.project.clientName,
        baseWireframeUrl: resolveWireframeBaseUrl(resolved.project) ?? "",
      }}
      stories={stories.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        acceptanceCriteria: s.acceptanceCriteria,
        startPath: s.startPath,
      }))}
      decisions={decisions.map((d) => ({
        storyId: d.userStoryId,
        status: d.status,
        decidedAt: d.decidedAt.toISOString(),
      }))}
      feedback={feedback.map((f) => ({
        id: f.id,
        storyId: f.userStoryId,
        kind: f.kind,
        body: f.body,
        createdAt: f.createdAt.toISOString(),
      }))}
      initialStoryId={initialStoryId ?? null}
    />
  );
}
