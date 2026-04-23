import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { resolveReviewerContext } from "@/lib/api-guard";

const BodySchema = z.object({
  body: z.string().trim().min(1).max(5000),
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

  const [row] = await db
    .insert(schema.feedbackEntries)
    .values({
      userStoryId: ctx.story.id,
      reviewerSessionId: ctx.session.id,
      kind: "text",
      body: parsed.data.body,
    })
    .returning();

  return NextResponse.json({ id: row.id, body: row.body });
}
