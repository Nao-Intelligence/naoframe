import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { NaoLogo } from "@/components/ui/NaoLogo";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdminUser();
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/admin" className="flex items-center">
            <NaoLogo className="h-7 w-auto" priority />
          </Link>
          <div className="flex items-center gap-4 text-sm text-zinc-600">
            <span>{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
