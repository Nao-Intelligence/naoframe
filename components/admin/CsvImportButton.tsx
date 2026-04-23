"use client";

import { useRef, useTransition } from "react";
import { importStoriesCsv } from "@/app/admin/actions";

export function CsvImportButton({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Importiere…" : "CSV-Import"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.set("file", file);
          e.currentTarget.value = "";
          startTransition(() => importStoriesCsv(projectId, fd));
        }}
      />
    </>
  );
}
