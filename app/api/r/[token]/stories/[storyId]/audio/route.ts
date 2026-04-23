import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { resolveReviewerContext } from "@/lib/api-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transcribeAudio } from "@/lib/whisper";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB (Whisper limit)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; storyId: string }> },
) {
  const { token, storyId } = await params;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_form" }, { status: 400 });

  const file = form.get("audio");
  const durationRaw = form.get("duration_ms");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_audio" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "audio_too_large" }, { status: 413 });
  }
  const durationMs =
    typeof durationRaw === "string" && /^\d+$/.test(durationRaw)
      ? parseInt(durationRaw, 10)
      : null;

  const ctx = await resolveReviewerContext(token, storyId);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ext = file.type.includes("webm") ? "webm" : "bin";
  const key = `${ctx.project.id}/${ctx.story.id}/${ctx.session.id}-${Date.now()}.${ext}`;

  const supabase = supabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());
  const upload = await supabase.storage
    .from(env.AUDIO_BUCKET)
    .upload(key, buffer, {
      contentType: file.type || "audio/webm",
      upsert: false,
    });
  if (upload.error) {
    return NextResponse.json(
      { error: "storage_failed", detail: upload.error.message },
      { status: 500 },
    );
  }

  let transcript = "";
  try {
    transcript = await transcribeAudio(
      new File([buffer], `audio.${ext}`, { type: file.type || "audio/webm" }),
      { language: "de" },
    );
  } catch (err) {
    await supabase.storage.from(env.AUDIO_BUCKET).remove([key]);
    return NextResponse.json(
      {
        error: "transcription_failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const [row] = await db
    .insert(schema.feedbackEntries)
    .values({
      userStoryId: ctx.story.id,
      reviewerSessionId: ctx.session.id,
      kind: "audio",
      body: transcript,
      audioObjectKey: key,
      audioDurationMs: durationMs,
    })
    .returning();

  return NextResponse.json({
    id: row.id,
    body: row.body,
    audioObjectKey: row.audioObjectKey,
  });
}
