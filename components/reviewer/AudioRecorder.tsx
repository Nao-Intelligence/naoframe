"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onSubmit: (blob: Blob, durationMs: number) => Promise<void>;
};

const MAX_DURATION_MS = 5 * 60 * 1000;

export function AudioRecorder({ disabled, onSubmit }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);

  const [supported, setSupported] = useState<boolean>(true);
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported(
      !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined",
    );
  }, []);

  useEffect(() => {
    if (state !== "recording") return;
    const t = window.setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsed(ms);
      if (ms >= MAX_DURATION_MS) stop();
    }, 250);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const durationMs = Date.now() - startedAtRef.current;
        setState("uploading");
        try {
          await onSubmit(blob, durationMs);
          setState("idle");
          setElapsed(0);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
          setState("idle");
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setState("recording");
    } catch {
      setError("Mikrofon-Zugriff verweigert oder nicht verfügbar.");
    }
  }

  function stop() {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  }

  if (!supported) {
    return (
      <p className="text-xs text-zinc-500">
        Audio-Aufnahme wird in diesem Browser nicht unterstützt.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {state === "idle" ? (
          <button
            type="button"
            onClick={start}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            <span className="h-2 w-2 rounded-full bg-white" />
            Aufnahme starten
          </button>
        ) : null}
        {state === "recording" ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <span className="h-2 w-2 rounded-sm bg-rose-500" />
            Stop · {formatDuration(elapsed)}
          </button>
        ) : null}
        {state === "uploading" ? (
          <span className="text-sm text-zinc-600">Transkribiere…</span>
        ) : null}
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}
