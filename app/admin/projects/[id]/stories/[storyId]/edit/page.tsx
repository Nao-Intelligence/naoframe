import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { updateStory } from "@/app/admin/actions";

export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ id: string; storyId: string }>;
}) {
  const { id, storyId } = await params;
  const story = await db.query.userStories.findFirst({
    where: and(
      eq(schema.userStories.id, storyId),
      eq(schema.userStories.projectId, id),
    ),
  });
  if (!story) notFound();

  const action = updateStory.bind(null, id, storyId);

  return (
    <div className="max-w-2xl">
      <Link
        href={`/admin/projects/${id}`}
        className="text-sm text-zinc-600 hover:underline"
      >
        ← Projekt
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Story bearbeiten</h1>
      <form
        action={action}
        className="mt-6 space-y-4 rounded-lg border border-zinc-200 bg-white p-6"
      >
        <label className="block">
          <span className="block text-sm font-medium text-zinc-800">Titel</span>
          <input
            name="title"
            required
            defaultValue={story.title}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-zinc-800">
            Start-Pfad
          </span>
          <input
            name="start_path"
            defaultValue={story.startPath}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-zinc-800">
            Beschreibung
          </span>
          <textarea
            name="description"
            rows={4}
            defaultValue={story.description}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-zinc-800">
            Akzeptanzkriterien
          </span>
          <textarea
            name="acceptance_criteria"
            rows={4}
            defaultValue={story.acceptanceCriteria}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Speichern
          </button>
          <Link
            href={`/admin/projects/${id}`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
