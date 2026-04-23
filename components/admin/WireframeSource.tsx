"use client";

import { useRef, useTransition } from "react";
import {
  removeWireframeBundle,
  updateProjectBaseUrl,
  uploadWireframeBundle,
} from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

type Props = {
  projectId: string;
  baseWireframeUrl: string | null;
  uploadPath: string | null;
  effectiveUrl: string | null;
};

export function WireframeSource({
  projectId,
  baseWireframeUrl,
  uploadPath,
  effectiveUrl,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [removing, startRemove] = useTransition();
  const mode: "bundle" | "url" | "none" = uploadPath
    ? "bundle"
    : baseWireframeUrl
      ? "url"
      : "none";

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Wireframe-Quelle</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Externe URL oder hochgeladenes Bundle — das Bundle hat Vorrang.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            mode === "bundle"
              ? "bg-violet-100 text-violet-800"
              : mode === "url"
                ? "bg-sky-100 text-sky-800"
                : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {mode === "bundle"
            ? "HTML-Bundle aktiv"
            : mode === "url"
              ? "Externe URL aktiv"
              : "Keine Quelle"}
        </span>
      </header>

      <div className="px-6 py-5">
        {effectiveUrl ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs">
            <div className="text-zinc-500">Aktuell im Reviewer verwendet:</div>
            <code className="mt-1.5 block break-all font-mono text-zinc-800">
              {effectiveUrl}
            </code>
          </div>
        ) : (
          <div className="rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Es ist weder eine URL gesetzt noch ein HTML-Bundle hochgeladen. Share-Links
            funktionieren erst, sobald eine Quelle vorhanden ist.
          </div>
        )}
      </div>

      {/* Option 1: External URL */}
      <div className="border-t border-zinc-200 bg-zinc-50/40 px-6 py-6">
        <h3 className="text-sm font-semibold text-zinc-900">Externe URL</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Link auf einen gehosteten Wireframe (z.B. Netlify-Preview).
        </p>
        <form
          action={updateProjectBaseUrl.bind(null, projectId)}
          className="mt-3 flex gap-2"
        >
          <input
            name="base_wireframe_url"
            type="url"
            defaultValue={baseWireframeUrl ?? ""}
            placeholder="https://wire.acme-preview.nao.dev"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
          <SubmitButton
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60"
            pendingLabel="Speichere…"
          >
            Speichern
          </SubmitButton>
        </form>
      </div>

      {/* Option 2: HTML Bundle */}
      <div className="border-t border-zinc-200 bg-zinc-50/40 px-6 py-6">
        <h3 className="text-sm font-semibold text-zinc-900">HTML-Bundle (.zip)</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          ZIP mit <code className="rounded bg-zinc-200 px-1 py-0.5 font-mono">index.html</code>{" "}
          als Einstiegspunkt. Nested folders werden übernommen.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50"
          >
            {uploading ? "Lade hoch…" : uploadPath ? "Bundle ersetzen" : "Bundle hochladen"}
          </button>
          {uploadPath ? (
            <button
              type="button"
              disabled={removing}
              onClick={() => {
                if (confirm("Bundle wirklich entfernen?"))
                  startRemove(() => removeWireframeBundle(projectId));
              }}
              className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {removing ? "Lösche…" : "Bundle entfernen"}
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.set("file", file);
              e.currentTarget.value = "";
              startUpload(() => uploadWireframeBundle(projectId, fd));
            }}
          />
        </div>
      </div>
    </section>
  );
}
