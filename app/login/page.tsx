import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { NaoLogo } from "@/components/ui/NaoLogo";
import { signIn, sendPasswordReset } from "./actions";

export const metadata: Metadata = { title: "Login · naoframe" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset_sent?: string; error?: string; mode?: string }>;
}) {
  const user = await getAdminUser();
  if (user) redirect("/admin");

  const { reset_sent, error, mode } = await searchParams;
  const isReset = mode === "reset";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 px-6 py-12">
      <div className="mb-6">
        <NaoLogo className="h-10 w-auto" priority />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">naoframe · Admin</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {isReset
            ? "Gib deine E-Mail an — wir schicken dir einen Link zum Setzen eines neuen Passworts."
            : "Login für interne Nao-Mitarbeiter."}
        </p>

        {reset_sent ? (
          <div className="mt-6 rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">
            Reset-Link verschickt. Bitte prüfe dein Postfach.
          </div>
        ) : isReset ? (
          <form action={sendPasswordReset} className="mt-6 space-y-4">
            <Field id="email" name="email" label="E-Mail" type="email" autoComplete="email" required />
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Reset-Link senden
            </button>
            {error ? <ErrorMessage code={error} /> : null}
            <p className="text-xs text-zinc-500">
              <Link href="/login" className="hover:underline">
                ← Zurück zum Login
              </Link>
            </p>
          </form>
        ) : (
          <form action={signIn} className="mt-6 space-y-4">
            <Field id="email" name="email" label="E-Mail" type="email" autoComplete="email" required />
            <Field id="password" name="password" label="Passwort" type="password" autoComplete="current-password" required />
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Anmelden
            </button>
            {error ? <ErrorMessage code={error} /> : null}
            <p className="text-xs text-zinc-500">
              <Link href="/login?mode=reset" className="hover:underline">
                Passwort vergessen?
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  name,
  label,
  type,
  autoComplete,
  required,
}: {
  id: string;
  name: string;
  label: string;
  type: string;
  autoComplete?: "email" | "current-password" | "new-password";
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
      />
    </div>
  );
}

function ErrorMessage({ code }: { code: string }) {
  const msg =
    code === "invalid_credentials"
      ? "E-Mail oder Passwort falsch."
      : code === "missing_email"
        ? "Bitte E-Mail eingeben."
        : code === "send_failed"
          ? "Fehler beim Versand. Bitte erneut versuchen."
          : "Unbekannter Fehler.";
  return <p className="text-sm text-red-600">{msg}</p>;
}
