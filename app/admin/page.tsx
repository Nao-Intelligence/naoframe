import Link from "next/link";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { formatDate } from "@/lib/utils";

type ProjectStats = {
  stories: number;
  feedback: number;
  accepted: number;
  rejected: number;
  answeredStories: number;
};

export default async function AdminHome() {
  const projects = await db
    .select()
    .from(schema.projects)
    .where(isNull(schema.projects.archivedAt))
    .orderBy(desc(schema.projects.createdAt));

  const stats = await loadProjectStats();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projekte</h1>
        <Link
          href="/admin/projects/new"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Neues Projekt
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-zinc-600">
            Noch keine Projekte. Leg eins an, um loszulegen.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {projects.map((p) => {
            const s = stats.get(p.id) ?? {
              stories: 0,
              feedback: 0,
              accepted: 0,
              rejected: 0,
              answeredStories: 0,
            };
            const answeredPct =
              s.stories > 0
                ? Math.round((s.answeredStories / s.stories) * 100)
                : 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/projects/${p.id}`}
                  className="flex items-center justify-between gap-6 px-5 py-4 hover:bg-zinc-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-900">{p.name}</div>
                    <div className="truncate text-sm text-zinc-600">
                      {p.clientName ?? "—"}
                      {p.uploadPath
                        ? " · 📦 HTML-Bundle"
                        : p.baseWireframeUrl
                          ? ` · ${p.baseWireframeUrl}`
                          : " · (keine Quelle)"}
                    </div>
                    {s.stories > 0 ? (
                      <div className="mt-2 max-w-sm">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500">
                          <span>
                            Beantwortet: {s.answeredStories}/{s.stories}
                          </span>
                          <span className="font-medium text-zinc-900">
                            {answeredPct}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                          {/* eslint-disable-next-line react/forbid-dom-props */}
                          <div
                            className="h-full bg-zinc-900 transition-[width]"
                            style={{ width: `${answeredPct}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <Stat label="Stories" value={s.stories} />
                    <Stat label="💬" value={s.feedback} />
                    <Stat label="✓" value={s.accepted} tone="emerald" />
                    <Stat label="✕" value={s.rejected} tone="rose" />
                  </div>
                  <div className="shrink-0 text-xs text-zinc-500">
                    {formatDate(p.createdAt)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

async function loadProjectStats(): Promise<Map<string, ProjectStats>> {
  const [storyRows, feedbackRows, decisionRows, answeredRows] = await Promise.all([
    db
      .select({
        projectId: schema.userStories.projectId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.userStories)
      .groupBy(schema.userStories.projectId),
    db
      .select({
        projectId: schema.userStories.projectId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.feedbackEntries)
      .innerJoin(
        schema.userStories,
        eq(schema.feedbackEntries.userStoryId, schema.userStories.id),
      )
      .groupBy(schema.userStories.projectId),
    db
      .select({
        projectId: schema.userStories.projectId,
        status: schema.storyDecisions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.storyDecisions)
      .innerJoin(
        schema.userStories,
        eq(schema.storyDecisions.userStoryId, schema.userStories.id),
      )
      .groupBy(schema.userStories.projectId, schema.storyDecisions.status),
    db
      .select({
        projectId: schema.userStories.projectId,
        count: sql<number>`count(distinct ${schema.storyDecisions.userStoryId})::int`,
      })
      .from(schema.storyDecisions)
      .innerJoin(
        schema.userStories,
        eq(schema.storyDecisions.userStoryId, schema.userStories.id),
      )
      .groupBy(schema.userStories.projectId),
  ]);

  const map = new Map<string, ProjectStats>();
  const ensure = (id: string): ProjectStats => {
    let entry = map.get(id);
    if (!entry) {
      entry = {
        stories: 0,
        feedback: 0,
        accepted: 0,
        rejected: 0,
        answeredStories: 0,
      };
      map.set(id, entry);
    }
    return entry;
  };

  for (const r of storyRows) ensure(r.projectId).stories = r.count;
  for (const r of feedbackRows) ensure(r.projectId).feedback = r.count;
  for (const r of decisionRows) {
    const s = ensure(r.projectId);
    if (r.status === "accepted") s.accepted = r.count;
    else if (r.status === "rejected") s.rejected = r.count;
  }
  for (const r of answeredRows) ensure(r.projectId).answeredStories = r.count;
  return map;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "rose";
}) {
  const classes =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "rose"
        ? "bg-rose-50 text-rose-700"
        : "bg-zinc-100 text-zinc-700";
  return (
    <span className={`rounded-full px-2 py-0.5 ${classes}`}>
      {label} {value}
    </span>
  );
}
