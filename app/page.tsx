import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          naoframe
        </h1>
        <p className="mt-3 text-zinc-600">
          Wireframe-Review-Tool für Nao Intelligence. Kunden öffnen Reviews über
          einen persönlichen Share-Link; Nao-Mitarbeiter verwalten Projekte im
          Admin-Bereich.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/admin"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Zum Admin
          </Link>
        </div>
      </div>
    </main>
  );
}
