"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AudioRecorder } from "./AudioRecorder";
import {
  type ReviewDecision,
  type ReviewFeedback,
  type ReviewStory,
  latestDecision,
} from "./types";

type Props = {
  token: string;
  story: ReviewStory;
  decisions: ReviewDecision[];
  feedback: ReviewFeedback[];
  onBack: () => void;
};

export function StoryDetail({ token, story, decisions, feedback, onBack }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState<
    null | "text" | "accept" | "reject"
  >(null);
  const [error, setError] = useState<string | null>(null);

  const storyFeedback = feedback
    .filter((f) => f.storyId === story.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const latest = latestDecision(story.id, decisions);
  const hasFeedback = storyFeedback.length > 0;

  async function submitText(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting("text");
    setError(null);
    const res = await fetch(
      `/api/r/${token}/stories/${story.id}/feedback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim() }),
      },
    );
    setSubmitting(null);
    if (!res.ok) {
      setError("Konnte Feedback nicht speichern.");
      return;
    }
    setText("");
    router.refresh();
  }

  async function submitAudio(blob: Blob, durationMs: number) {
    const fd = new FormData();
    const ext = blob.type.includes("webm") ? "webm" : "bin";
    fd.set("audio", blob, `feedback.${ext}`);
    fd.set("duration_ms", String(durationMs));
    const res = await fetch(
      `/api/r/${token}/stories/${story.id}/audio`,
      {
        method: "POST",
        body: fd,
      },
    );
    if (!res.ok) {
      let message = `Upload fehlgeschlagen (HTTP ${res.status})`;
      try {
        const body = (await res.json()) as { error?: string; detail?: string };
        if (body.error) message += ` — ${body.error}`;
        if (body.detail) message += `: ${body.detail}`;
      } catch {
        // response wasn't JSON
      }
      throw new Error(message);
    }
    router.refresh();
  }

  async function decide(status: "accepted" | "rejected") {
    if (status === "rejected" && !hasFeedback) {
      setError("Für eine Ablehnung bitte mindestens ein Feedback hinterlassen.");
      return;
    }
    setSubmitting(status === "accepted" ? "accept" : "reject");
    setError(null);
    const res = await fetch(
      `/api/r/${token}/stories/${story.id}/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (!res.ok) {
      setSubmitting(null);
      setError("Entscheidung konnte nicht gespeichert werden.");
      return;
    }
    router.refresh();
    // keep `submitting` set until the refresh completes and server-side data
    // shows the new decision status; otherwise the button briefly flashes back
    // to its idle label between server call and refresh.
    setTimeout(() => setSubmitting(null), 200);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
        >
          ← Liste
        </button>
        <span className="truncate text-sm font-medium">{story.title}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <DecisionBadge status={latest?.status ?? null} />

        {story.description ? (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Beschreibung
            </h4>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
              {story.description}
            </p>
          </div>
        ) : null}

        {story.acceptanceCriteria ? (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Akzeptanzkriterien
            </h4>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
              {story.acceptanceCriteria}
            </p>
          </div>
        ) : null}

        <div className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Feedback
          </h4>
          {storyFeedback.length === 0 ? (
            <p className="mt-1 text-xs text-zinc-500">Noch kein Feedback.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {storyFeedback.map((f) => (
                <li
                  key={f.id}
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800"
                >
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {f.kind === "audio" ? "🎙️ Audio" : "💬 Text"}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{f.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={submitText} className="mt-6 space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Neues Feedback
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Text-Feedback oder Änderungswunsch…"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <AudioRecorder
              disabled={submitting === "text"}
              onSubmit={submitAudio}
            />
            <button
              type="submit"
              disabled={!text.trim() || submitting === "text"}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting === "text" ? "Sende…" : "Senden"}
            </button>
          </div>
        </form>

        {error ? (
          <p className="mt-3 text-xs text-rose-600">{error}</p>
        ) : null}
      </div>

      <div className="border-t border-zinc-200 p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => decide("accepted")}
            disabled={submitting !== null}
            aria-busy={submitting === "accept" ? "true" : "false"}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting === "accept" ? (
              <>
                <Spinner />
                <span>Speichere…</span>
              </>
            ) : (
              <span>✓ Akzeptieren</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => decide("rejected")}
            disabled={submitting !== null}
            aria-busy={submitting === "reject" ? "true" : "false"}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting === "reject" ? (
              <>
                <Spinner />
                <span>Speichere…</span>
              </>
            ) : (
              <span>✕ Ablehnen</span>
            )}
          </button>
        </div>
        {!hasFeedback ? (
          <p className="mt-2 text-[11px] text-zinc-500">
            Ablehnung erfordert mindestens ein Feedback.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function DecisionBadge({ status }: { status: "accepted" | "rejected" | null }) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">
        Ausstehend
      </span>
    );
  }
  if (status === "accepted") {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
        ✓ Akzeptiert
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
      ✕ Abgelehnt
    </span>
  );
}
