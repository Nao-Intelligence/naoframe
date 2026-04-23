import Link from "next/link";
import { createProject } from "@/app/admin/actions";

export default function NewProjectPage() {
  return (
    <div className="max-w-xl">
      <Link href="/admin" className="text-sm text-zinc-600 hover:underline">
        ← Zurück
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Neues Projekt</h1>
      <form
        action={createProject}
        className="mt-6 space-y-5 rounded-lg border border-zinc-200 bg-white p-6"
      >
        <Field name="name" label="Projektname" placeholder="z.B. Acme Onboarding" required />
        <Field name="client_name" label="Kunde" placeholder="z.B. Acme GmbH" />

        <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Wireframe-Quelle</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Entweder eine externe URL oder ein HTML-Bundle — beides optional, du kannst
              es auch später setzen. Wenn beides gesetzt ist, hat das Bundle Vorrang.
            </p>
          </div>

          <Field
            name="base_wireframe_url"
            label="Externe URL (optional)"
            placeholder="https://wire.acme-preview.nao.dev"
            type="url"
          />

          <label className="block">
            <span className="block text-sm font-medium text-zinc-800">
              HTML-Bundle (optional, .zip)
            </span>
            <input
              name="wireframe_bundle"
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-xs file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              ZIP mit <code className="rounded bg-zinc-100 px-1">index.html</code> als
              Einstiegspunkt. Nested folders werden übernommen.
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Projekt anlegen
        </button>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  required,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-zinc-800">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
      />
    </label>
  );
}
