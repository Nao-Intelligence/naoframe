import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import {
  createShareLink,
  createStory,
  deleteStory,
  revokeShareLink,
} from "@/app/admin/actions";
import { CopyButton } from "@/components/admin/CopyButton";
import { CsvImportButton } from "@/components/admin/CsvImportButton";
import { DeleteProjectButton } from "@/components/admin/DeleteProjectButton";
import { WireframeSource } from "@/components/admin/WireframeSource";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { resolveWireframeBaseUrl } from "@/lib/wireframe";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    upload_ok?: string;
    upload_error?: string;
    detail?: string;
    import_ok?: string;
    import_error?: string;
    url_error?: string;
  }>;
}) {
  const { id } = await params;
  const flash = await searchParams;

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, id),
  });
  if (!project) notFound();

  const stories = await db
    .select()
    .from(schema.userStories)
    .where(eq(schema.userStories.projectId, id))
    .orderBy(asc(schema.userStories.orderIndex), asc(schema.userStories.createdAt));

  const shareLinks = await db
    .select()
    .from(schema.shareLinks)
    .where(eq(schema.shareLinks.projectId, id))
    .orderBy(desc(schema.shareLinks.createdAt));

  const shareLinkIds = shareLinks.map((l) => l.id);
  type ShareStats = {
    sessions: number;
    feedback: number;
    acceptedStories: number;
    rejectedStories: number;
  };
  const shareStatMap = new Map<string, ShareStats>();
  for (const lid of shareLinkIds)
    shareStatMap.set(lid, {
      sessions: 0,
      feedback: 0,
      acceptedStories: 0,
      rejectedStories: 0,
    });

  if (shareLinkIds.length > 0) {
    const [sessionRows, feedbackRows, rawDecisions] = await Promise.all([
      db
        .select({
          shareLinkId: schema.reviewerSessions.shareLinkId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.reviewerSessions)
        .where(inArray(schema.reviewerSessions.shareLinkId, shareLinkIds))
        .groupBy(schema.reviewerSessions.shareLinkId),
      db
        .select({
          shareLinkId: schema.reviewerSessions.shareLinkId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.feedbackEntries)
        .innerJoin(
          schema.reviewerSessions,
          eq(schema.feedbackEntries.reviewerSessionId, schema.reviewerSessions.id),
        )
        .where(inArray(schema.reviewerSessions.shareLinkId, shareLinkIds))
        .groupBy(schema.reviewerSessions.shareLinkId),
      db
        .select({
          shareLinkId: schema.reviewerSessions.shareLinkId,
          storyId: schema.storyDecisions.userStoryId,
          status: schema.storyDecisions.status,
        })
        .from(schema.storyDecisions)
        .innerJoin(
          schema.reviewerSessions,
          eq(schema.storyDecisions.reviewerSessionId, schema.reviewerSessions.id),
        )
        .where(inArray(schema.reviewerSessions.shareLinkId, shareLinkIds))
        .orderBy(desc(schema.storyDecisions.decidedAt)),
    ]);

    for (const r of sessionRows) {
      const s = shareStatMap.get(r.shareLinkId);
      if (s) s.sessions = r.count;
    }
    for (const r of feedbackRows) {
      const s = shareStatMap.get(r.shareLinkId);
      if (s) s.feedback = r.count;
    }
    // Collapse decisions to the latest status per (share_link, story). Since
    // rawDecisions is ordered desc, the first occurrence is the latest.
    const seen = new Set<string>();
    for (const r of rawDecisions) {
      const key = `${r.shareLinkId}:${r.storyId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const s = shareStatMap.get(r.shareLinkId);
      if (!s) continue;
      if (r.status === "accepted") s.acceptedStories++;
      else if (r.status === "rejected") s.rejectedStories++;
    }
  }

  const totalStories = stories.length;

  // Per-story stats: latest decision counts + feedback count.
  const storyIds = stories.map((s) => s.id);
  const decisions =
    storyIds.length > 0
      ? await db
          .select({
            userStoryId: schema.storyDecisions.userStoryId,
            status: schema.storyDecisions.status,
            count: sql<number>`count(*)::int`,
          })
          .from(schema.storyDecisions)
          .where(inArray(schema.storyDecisions.userStoryId, storyIds))
          .groupBy(schema.storyDecisions.userStoryId, schema.storyDecisions.status)
      : [];

  const feedbackCounts =
    storyIds.length > 0
      ? await db
          .select({
            userStoryId: schema.feedbackEntries.userStoryId,
            count: sql<number>`count(*)::int`,
          })
          .from(schema.feedbackEntries)
          .where(inArray(schema.feedbackEntries.userStoryId, storyIds))
          .groupBy(schema.feedbackEntries.userStoryId)
      : [];

  const statByStory = new Map<
    string,
    { accepted: number; rejected: number; feedback: number }
  >();
  for (const id of storyIds)
    statByStory.set(id, { accepted: 0, rejected: 0, feedback: 0 });
  for (const d of decisions) {
    const s = statByStory.get(d.userStoryId)!;
    if (d.status === "accepted") s.accepted = d.count;
    if (d.status === "rejected") s.rejected = d.count;
  }
  for (const f of feedbackCounts) {
    statByStory.get(f.userStoryId)!.feedback = f.count;
  }

  const createStoryBound = createStory.bind(null, id);
  const createShareLinkBound = createShareLink.bind(null, id);

  return (
    <div className="space-y-10">
      <div>
        <Link href="/admin" className="text-sm text-zinc-600 hover:underline">
          ← Projekte
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {project.clientName ?? "—"}
            </p>
          </div>
          <DeleteProjectButton projectId={project.id} projectName={project.name} />
        </div>
      </div>

      <FlashMessages flash={flash} />

      <WireframeSource
        projectId={project.id}
        baseWireframeUrl={project.baseWireframeUrl}
        uploadPath={project.uploadPath}
        effectiveUrl={resolveWireframeBaseUrl(project)}
      />

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">User Stories</h2>
          <div className="flex items-center gap-2">
            <a
              href={`/admin/projects/${id}/stories/export`}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
            >
              CSV-Export
            </a>
            <CsvImportButton projectId={id} />
          </div>
        </div>
        <form
          action={createStoryBound}
          className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="title"
              required
              placeholder="Titel der Story"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              name="start_path"
              placeholder="/start-path (z.B. /onboarding/step-1)"
              defaultValue="/"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <textarea
            name="description"
            placeholder="Beschreibung (Markdown erlaubt)"
            rows={2}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <textarea
            name="acceptance_criteria"
            placeholder="Akzeptanzkriterien"
            rows={2}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <SubmitButton
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
            pendingLabel="Lege an…"
          >
            Story hinzufügen
          </SubmitButton>
        </form>

        {stories.length > 0 ? (
          <ul className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
            {stories.map((s) => {
              const stat = statByStory.get(s.id) ?? { accepted: 0, rejected: 0, feedback: 0 };
              return (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-4 px-5 py-4"
                >
                  <Link
                    href={`/admin/projects/${id}/stories/${s.id}`}
                    className="min-w-0 flex-1 hover:opacity-80"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">{s.title}</span>
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-700">
                        {s.startPath}
                      </code>
                    </div>
                    {s.description ? (
                      <p className="mt-1 text-sm text-zinc-600 line-clamp-2">
                        {s.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex gap-3 text-xs">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                        ✓ {stat.accepted}
                      </span>
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
                        ✕ {stat.rejected}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
                        💬 {stat.feedback}
                      </span>
                    </div>
                  </Link>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/admin/projects/${id}/stories/${s.id}`}
                      className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
                    >
                      Details
                    </Link>
                    <Link
                      href={`/admin/projects/${id}/stories/${s.id}/edit`}
                      className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
                    >
                      Bearbeiten
                    </Link>
                    <form action={deleteStory.bind(null, id, s.id)}>
                      <SubmitButton
                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
                        pendingLabel="Lösche…"
                      >
                        Löschen
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Share Links</h2>
        <form
          action={createShareLinkBound}
          className="mt-4 flex gap-3 rounded-lg border border-zinc-200 bg-white p-4"
        >
          <input
            name="label"
            placeholder="Label (z.B. 'Kunde Acme — CEO')"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <SubmitButton
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
            pendingLabel="Erzeuge…"
          >
            Link erzeugen
          </SubmitButton>
        </form>

        {shareLinks.length > 0 ? (
          <ul className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
            {shareLinks.map((l) => {
              const status = l.revokedAt
                ? "widerrufen"
                : l.expiresAt && l.expiresAt < new Date()
                  ? "abgelaufen"
                  : "aktiv";
              const url = `${env.APP_URL}/r/${l.token}`;
              const ls = shareStatMap.get(l.id) ?? {
                sessions: 0,
                feedback: 0,
                acceptedStories: 0,
                rejectedStories: 0,
              };
              const answeredStories = ls.acceptedStories + ls.rejectedStories;
              const acceptedPct =
                totalStories > 0
                  ? Math.round((ls.acceptedStories / totalStories) * 100)
                  : 0;
              const rejectedPct =
                totalStories > 0
                  ? Math.round((ls.rejectedStories / totalStories) * 100)
                  : 0;
              const answeredPct = acceptedPct + rejectedPct;
              return (
                <li key={l.id} className="space-y-4 px-5 py-4">
                  {/* Header: label + status + revoke */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-900">
                        {l.label ?? "Unbenannter Link"}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {formatDate(l.createdAt)} ·{" "}
                        <span
                          className={
                            status === "aktiv"
                              ? "text-emerald-700"
                              : "text-zinc-500"
                          }
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                    {status === "aktiv" ? (
                      <form action={revokeShareLink.bind(null, id, l.id)}>
                        <SubmitButton
                          className="shrink-0 rounded-md border border-zinc-300 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
                          pendingLabel="Widerrufe…"
                        >
                          Widerrufen
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>

                  {/* URL row */}
                  {status === "aktiv" ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs font-mono text-zinc-700">
                        {url}
                      </code>
                      <CopyButton value={url} />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                      >
                        Öffnen
                      </a>
                    </div>
                  ) : null}

                  {/* Progress + meta */}
                  {totalStories > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-zinc-600">
                          <span className="font-medium text-zinc-900">
                            {answeredStories}
                          </span>
                          /{totalStories} Stories beantwortet
                        </span>
                        <span className="font-semibold text-zinc-900">
                          {answeredPct}%
                        </span>
                      </div>
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                        {/* eslint-disable-next-line react/forbid-dom-props */}
                        <div
                          className="h-full bg-emerald-500 transition-[width]"
                          style={{ width: `${acceptedPct}%` }}
                        />
                        {/* eslint-disable-next-line react/forbid-dom-props */}
                        <div
                          className="h-full bg-rose-500 transition-[width]"
                          style={{ width: `${rejectedPct}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>
                            {ls.acceptedStories}{" "}
                            <span className="text-zinc-400">akzeptiert</span>
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          <span>
                            {ls.rejectedStories}{" "}
                            <span className="text-zinc-400">abgelehnt</span>
                          </span>
                        </span>
                        <span className="text-zinc-300">·</span>
                        <span>
                          {ls.sessions}{" "}
                          <span className="text-zinc-400">
                            {ls.sessions === 1 ? "Reviewer" : "Reviewer"}
                          </span>
                        </span>
                        <span>
                          {ls.feedback}{" "}
                          <span className="text-zinc-400">Feedback</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500">
                      {ls.sessions}{" "}
                      <span className="text-zinc-400">
                        {ls.sessions === 1 ? "Reviewer" : "Reviewer"}
                      </span>{" "}
                      · {ls.feedback}{" "}
                      <span className="text-zinc-400">Feedback</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function FlashMessages({
  flash,
}: {
  flash: {
    upload_ok?: string;
    upload_error?: string;
    detail?: string;
    import_ok?: string;
    import_error?: string;
    url_error?: string;
  };
}) {
  const messages: { tone: "success" | "error"; text: string }[] = [];
  if (flash.upload_ok) {
    messages.push({
      tone: "success",
      text: `Bundle hochgeladen — ${flash.upload_ok} Dateien übertragen.`,
    });
  }
  if (flash.upload_error) {
    const code = flash.upload_error;
    const label =
      code === "no_file"
        ? "Keine Datei ausgewählt."
        : code === "too_large"
          ? "Datei zu groß (max. 100 MB)."
          : code === "invalid_zip"
            ? "Datei ist kein gültiges ZIP."
            : code === "no_index"
              ? "ZIP enthält keine index.html."
              : code === "upload_failed"
                ? `Upload fehlgeschlagen${flash.detail ? ` — ${flash.detail}` : ""}`
                : `Upload-Fehler: ${code}`;
    messages.push({ tone: "error", text: label });
  }
  if (flash.import_ok) {
    messages.push({
      tone: "success",
      text: `${flash.import_ok} Stories importiert.`,
    });
  }
  if (flash.import_error) {
    const code = flash.import_error;
    const label =
      code === "no_file"
        ? "Keine CSV-Datei ausgewählt."
        : code === "empty"
          ? "CSV enthält keine Zeilen."
          : code === "no_valid_rows"
            ? "Keine gültigen Zeilen gefunden (title + start_path pflicht)."
            : `Import-Fehler: ${code}`;
    messages.push({ tone: "error", text: label });
  }
  if (flash.url_error) {
    messages.push({
      tone: "error",
      text: flash.url_error === "invalid" ? "Ungültige URL." : `URL-Fehler: ${flash.url_error}`,
    });
  }

  if (messages.length === 0) return null;
  return (
    <div className="space-y-2">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`rounded-md border px-4 py-2 text-sm ${
            m.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
