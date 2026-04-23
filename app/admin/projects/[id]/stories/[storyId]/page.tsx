import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSignedAudioUrls } from "@/lib/storage";
import { formatDate } from "@/lib/utils";

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string; storyId: string }>;
}) {
  const { id, storyId } = await params;
  const story = await db.query.userStories.findFirst({
    where: and(
      eq(schema.userStories.id, storyId),
      eq(schema.userStories.projectId, id),
    ),
  });
  if (!story) notFound();

  const feedback = await db
    .select({
      entry: schema.feedbackEntries,
      session: schema.reviewerSessions,
      shareLink: schema.shareLinks,
    })
    .from(schema.feedbackEntries)
    .innerJoin(
      schema.reviewerSessions,
      eq(schema.feedbackEntries.reviewerSessionId, schema.reviewerSessions.id),
    )
    .innerJoin(
      schema.shareLinks,
      eq(schema.reviewerSessions.shareLinkId, schema.shareLinks.id),
    )
    .where(eq(schema.feedbackEntries.userStoryId, storyId))
    .orderBy(desc(schema.feedbackEntries.createdAt));

  const decisions = await db
    .select({
      decision: schema.storyDecisions,
      session: schema.reviewerSessions,
      shareLink: schema.shareLinks,
    })
    .from(schema.storyDecisions)
    .innerJoin(
      schema.reviewerSessions,
      eq(schema.storyDecisions.reviewerSessionId, schema.reviewerSessions.id),
    )
    .innerJoin(
      schema.shareLinks,
      eq(schema.reviewerSessions.shareLinkId, schema.shareLinks.id),
    )
    .where(eq(schema.storyDecisions.userStoryId, storyId))
    .orderBy(asc(schema.storyDecisions.decidedAt));

  const audioKeys = feedback
    .map((f) => f.entry.audioObjectKey)
    .filter((k): k is string => !!k);
  const audioUrls = await createSignedAudioUrls(audioKeys);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/projects/${id}`}
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Projekt
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{story.title}</h1>
            <div className="mt-1 text-sm text-zinc-600">
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
                {story.startPath}
              </code>
            </div>
          </div>
          <Link
            href={`/admin/projects/${id}/stories/${storyId}/edit`}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Bearbeiten
          </Link>
        </div>
      </div>

      {story.description ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Beschreibung
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
            {story.description}
          </p>
        </section>
      ) : null}

      {story.acceptanceCriteria ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Akzeptanzkriterien
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
            {story.acceptanceCriteria}
          </p>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">
          Entscheidungen ({decisions.length})
        </h2>
        {decisions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Noch keine Entscheidungen.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
            {decisions.map((d) => (
              <li
                key={d.decision.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div>
                  <div>
                    {d.decision.status === "accepted" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        ✓ Akzeptiert
                      </span>
                    ) : (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
                        ✕ Abgelehnt
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {d.shareLink.label ?? "Unbenannter Link"} ·{" "}
                    {d.session.reviewerEmail ?? "Anonym"}
                  </div>
                </div>
                <div className="text-xs text-zinc-500">
                  {formatDate(d.decision.decidedAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Feedback ({feedback.length})</h2>
        {feedback.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Noch kein Feedback.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {feedback.map((f) => (
              <li
                key={f.entry.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {f.entry.kind === "audio" ? "🎙️ Audio" : "💬 Text"} ·{" "}
                    {f.shareLink.label ?? "Unbenannter Link"} ·{" "}
                    {f.session.reviewerEmail ?? "Anonym"}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {formatDate(f.entry.createdAt)}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-zinc-800">
                  {f.entry.body}
                </p>
                {f.entry.audioObjectKey &&
                audioUrls.get(f.entry.audioObjectKey) ? (
                  <audio
                    controls
                    src={audioUrls.get(f.entry.audioObjectKey)}
                    className="mt-3 w-full"
                  >
                    <track kind="captions" />
                  </audio>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
