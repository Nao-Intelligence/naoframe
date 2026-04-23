"use client";

import { useEffect, useMemo, useState } from "react";
import { joinWireframeUrl } from "@/lib/utils";
import { IframePane } from "./IframePane";
import { StoryDetail } from "./StoryDetail";
import {
  type ReviewDecision,
  type ReviewFeedback,
  type ReviewProject,
  type ReviewStory,
  latestDecision,
} from "./types";

type Props = {
  token: string;
  project: ReviewProject;
  stories: ReviewStory[];
  decisions: ReviewDecision[];
  feedback: ReviewFeedback[];
  initialStoryId: string | null;
};

export function ReviewShell({
  token,
  project,
  stories,
  decisions,
  feedback,
  initialStoryId,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialStoryId && stories.some((s) => s.id === initialStoryId)
      ? initialStoryId
      : null,
  );

  const selected = useMemo(
    () => stories.find((s) => s.id === selectedId) ?? null,
    [selectedId, stories],
  );

  const iframeSrc = useMemo(() => {
    if (!selected) return project.baseWireframeUrl;
    return joinWireframeUrl(project.baseWireframeUrl, selected.startPath);
  }, [project.baseWireframeUrl, selected]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("story", selectedId);
    else url.searchParams.delete("story");
    window.history.replaceState(null, "", url.toString());
  }, [selectedId]);

  return (
    <div className="flex h-screen">
      <div className="relative flex-1">
        <IframePane src={iframeSrc} />
      </div>
      <aside className="flex h-full w-[380px] flex-col border-l border-zinc-200 bg-white">
        <header className="space-y-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {project.clientName ?? "Wireframe Review"}
            </div>
            <div className="text-sm font-semibold text-zinc-900">
              {project.name}
            </div>
          </div>
          <ProgressBar stories={stories} decisions={decisions} />
        </header>

        {selected ? (
          <StoryDetail
            token={token}
            story={selected}
            decisions={decisions}
            feedback={feedback}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <StoryList
            stories={stories}
            decisions={decisions}
            feedback={feedback}
            onSelect={setSelectedId}
          />
        )}
      </aside>
    </div>
  );
}

function StoryList({
  stories,
  decisions,
  feedback,
  onSelect,
}: {
  stories: ReviewStory[];
  decisions: ReviewDecision[];
  feedback: ReviewFeedback[];
  onSelect: (id: string) => void;
}) {
  if (stories.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500">
        Noch keine User Stories für dieses Projekt.
      </div>
    );
  }

  return (
    <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto">
      {stories.map((s) => {
        const decision = latestDecision(s.id, decisions);
        const feedbackCount = feedback.filter((f) => f.storyId === s.id).length;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-zinc-50"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-zinc-900">
                  {s.title}
                </span>
                <StatusDot status={decision?.status ?? null} />
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">
                  {s.startPath}
                </code>
                {feedbackCount > 0 ? <span>💬 {feedbackCount}</span> : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ProgressBar({
  stories,
  decisions,
}: {
  stories: ReviewStory[];
  decisions: ReviewDecision[];
}) {
  if (stories.length === 0) return null;
  let accepted = 0;
  let rejected = 0;
  for (const s of stories) {
    const d = latestDecision(s.id, decisions);
    if (d?.status === "accepted") accepted++;
    else if (d?.status === "rejected") rejected++;
  }
  const total = stories.length;
  const decided = accepted + rejected;
  const acceptedPct = Math.round((accepted / total) * 100);
  const rejectedPct = Math.round((rejected / total) * 100);

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-600">
        <span>Fortschritt</span>
        <span className="font-medium text-zinc-900">
          {acceptedPct}% akzeptiert · {decided}/{total}
        </span>
      </div>
      <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        {/* eslint-disable-next-line react/forbid-dom-props */}
        <div className="bg-emerald-500 transition-[width]" style={{ width: `${acceptedPct}%` }} />
        {/* eslint-disable-next-line react/forbid-dom-props */}
        <div className="bg-rose-500 transition-[width]" style={{ width: `${rejectedPct}%` }} />
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: "accepted" | "rejected" | null }) {
  const cls =
    status === "accepted"
      ? "bg-emerald-500"
      : status === "rejected"
        ? "bg-rose-500"
        : "bg-zinc-300";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}
