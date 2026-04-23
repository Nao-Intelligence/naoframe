"use client";

import { useState, useTransition } from "react";
import { deleteProject } from "@/app/admin/actions";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
      >
        Projekt löschen
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-600">
        „{projectName}" inkl. Stories, Feedback, Audio-Dateien wirklich löschen?
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => deleteProject(projectId))}
        disabled={pending}
        className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
      >
        {pending ? "Lösche…" : "Ja, löschen"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
      >
        Abbrechen
      </button>
    </div>
  );
}
