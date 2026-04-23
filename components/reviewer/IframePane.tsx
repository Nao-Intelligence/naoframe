"use client";

import { useEffect, useRef, useState } from "react";

export function IframePane({ src }: { src: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "blocked">("loading");

  useEffect(() => {
    setStatus("loading");
    const timer = window.setTimeout(() => {
      // Heuristic: if iframe hasn't fired `load` within 5s assume it's
      // being blocked by X-Frame-Options or CSP frame-ancestors.
      setStatus((s) => (s === "loading" ? "blocked" : s));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [src]);

  return (
    <div className="flex h-full w-full flex-col">
      <UrlBar src={src} />
      <div className="relative flex-1">
        <iframe
          ref={iframeRef}
          src={src}
          title="Wireframe"
          className="h-full w-full border-0 bg-white"
          onLoad={() => setStatus("loaded")}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
        {status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-zinc-500">
            Lade Wireframe…
          </div>
        ) : null}
        {status === "blocked" ? <IframeBlockedOverlay src={src} /> : null}
      </div>
    </div>
  );
}

function UrlBar({ src }: { src: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-3 py-2">
      <code className="flex-1 truncate rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-mono text-zinc-700">
        {src}
      </code>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
        title="In neuem Tab öffnen"
      >
        ↗
      </a>
    </div>
  );
}

function IframeBlockedOverlay({ src }: { src: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 p-6">
      <div className="max-w-md rounded-lg border border-zinc-300 bg-white p-6 text-sm">
        <h3 className="text-base font-semibold text-zinc-900">
          Wireframe kann nicht eingebettet werden
        </h3>
        <p className="mt-2 text-zinc-600">
          Der Server liefert einen Header (<code>X-Frame-Options</code> oder
          CSP <code>frame-ancestors</code>), der das Einbetten verhindert. Der
          Betreiber des Wireframes muss das Einbetten in diese Domain erlauben.
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          In neuem Tab öffnen
        </a>
      </div>
    </div>
  );
}
