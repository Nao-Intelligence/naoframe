import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { updatePassword } from "./actions";

export const metadata: Metadata = { title: "Passwort setzen · naoframe" };

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Neues Passwort setzen</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Angemeldet als <span className="font-medium">{user.email}</span>.
        </p>
        <form action={updatePassword} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-800">
              Neues Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">Mindestens 8 Zeichen.</p>
          </div>
          <SubmitButton
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
            pendingLabel="Speichere…"
          >
            Passwort speichern
          </SubmitButton>
          {error ? (
            <p className="text-sm text-red-600">
              {error === "too_short"
                ? "Passwort muss mindestens 8 Zeichen haben."
                : "Konnte Passwort nicht speichern."}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
