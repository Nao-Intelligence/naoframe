"use client";

import { useState } from "react";

export function CopyButton({
  value,
  label = "Kopieren",
  copiedLabel = "Kopiert!",
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API might be blocked (e.g. insecure context) — fall back to selection.
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        className ??
        "rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs hover:bg-zinc-50"
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
