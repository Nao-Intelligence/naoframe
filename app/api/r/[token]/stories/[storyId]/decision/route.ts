import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { resolveReviewerContext } from "@/lib/api-guard";

const BodySchema = z.object({
  status: z.enum(["accepted", "rejected"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; storyId: string }> },
) {
  const { token, storyId } = await params;
  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const ctx = await resolveReviewerContext(token, storyId);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (parsed.data.status === "rejected") {
    const existing = await db
      .select({ id: schema.feedbackEntries.id })
      .from(schema.feedbackEntries)
      .where(
        and(
          eq(schema.feedbackEntries.userStoryId, ctx.story.id),
          eq(schema.feedbackEntries.reviewerSessionId, ctx.session.id),
        ),
      )
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "feedback_required" },
        { status: 400 },
      );
    }
  }

  const [row] = await db
    .insert(schema.storyDecisions)
    .values({
      userStoryId: ctx.story.id,
      reviewerSessionId: ctx.session.id,
      status: parsed.data.status,
    })
    .returning();

  return NextResponse.json({ id: row.id, status: row.status });
}
