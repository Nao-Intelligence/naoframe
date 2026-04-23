"use server";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { requireAdminUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { generateShareToken } from "@/lib/share-token";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateStartPath } from "@/lib/utils";
import { parseCsv } from "@/lib/csv";
import { guessContentType, wireframeProjectPrefix } from "@/lib/wireframe";

export async function createProject(formData: FormData) {
  const user = await requireAdminUser();
  const name = String(formData.get("name") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();
  const baseUrl = String(formData.get("base_wireframe_url") ?? "").trim();

  if (!name) throw new Error("Name fehlt");
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      throw new Error("Ungültige Wireframe-URL");
    }
  }

  const [row] = await db
    .insert(schema.projects)
    .values({
      name,
      clientName: clientName || null,
      baseWireframeUrl: baseUrl || null,
      createdBy: user.id,
    })
    .returning({ id: schema.projects.id });

  // Optional wireframe bundle uploaded with the create form.
  const bundle = formData.get("wireframe_bundle");
  if (bundle instanceof File && bundle.size > 0) {
    const result = await processWireframeZip(row.id, bundle);
    if (result.ok) {
      await db
        .update(schema.projects)
        .set({ uploadPath: result.uploadPath })
        .where(eq(schema.projects.id, row.id));
    } else {
      const q = result.detail ? `&detail=${encodeURIComponent(result.detail)}` : "";
      revalidatePath("/admin");
      redirect(`/admin/projects/${row.id}?upload_error=${result.error}${q}`);
    }
  }

  revalidatePath("/admin");
  redirect(`/admin/projects/${row.id}`);
}

export async function updateProjectBaseUrl(
  projectId: string,
  formData: FormData,
) {
  await requireAdminUser();
  const baseUrl = String(formData.get("base_wireframe_url") ?? "").trim();
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      redirect(`/admin/projects/${projectId}?url_error=invalid`);
    }
  }
  await db
    .update(schema.projects)
    .set({ baseWireframeUrl: baseUrl || null })
    .where(eq(schema.projects.id, projectId));
  revalidatePath(`/admin/projects/${projectId}`);
  redirect(`/admin/projects/${projectId}`);
}

export async function createStory(projectId: string, formData: FormData) {
  await requireAdminUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const acceptanceCriteria = String(formData.get("acceptance_criteria") ?? "").trim();
  const startPathRaw = String(formData.get("start_path") ?? "/").trim();
  const startPath = validateStartPath(startPathRaw);

  if (!title) throw new Error("Titel fehlt");
  if (startPath === null) throw new Error("start_path muss mit /, ? oder # beginnen");

  const existing = await db
    .select({ id: schema.userStories.id })
    .from(schema.userStories)
    .where(eq(schema.userStories.projectId, projectId));

  await db.insert(schema.userStories).values({
    projectId,
    title,
    description,
    acceptanceCriteria,
    startPath,
    orderIndex: existing.length,
  });

  revalidatePath(`/admin/projects/${projectId}`);
  redirect(`/admin/projects/${projectId}`);
}

export async function updateStory(
  projectId: string,
  storyId: string,
  formData: FormData,
) {
  await requireAdminUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const acceptanceCriteria = String(formData.get("acceptance_criteria") ?? "").trim();
  const startPathRaw = String(formData.get("start_path") ?? "/").trim();
  const startPath = validateStartPath(startPathRaw);

  if (!title) throw new Error("Titel fehlt");
  if (startPath === null) throw new Error("start_path muss mit /, ? oder # beginnen");

  await db
    .update(schema.userStories)
    .set({ title, description, acceptanceCriteria, startPath })
    .where(
      and(
        eq(schema.userStories.id, storyId),
        eq(schema.userStories.projectId, projectId),
      ),
    );

  revalidatePath(`/admin/projects/${projectId}`);
  redirect(`/admin/projects/${projectId}`);
}

export async function deleteStory(projectId: string, storyId: string) {
  await requireAdminUser();
  await db
    .delete(schema.userStories)
    .where(
      and(
        eq(schema.userStories.id, storyId),
        eq(schema.userStories.projectId, projectId),
      ),
    );
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function createShareLink(projectId: string, formData: FormData) {
  const user = await requireAdminUser();
  const label = String(formData.get("label") ?? "").trim() || null;

  const token = generateShareToken();
  await db.insert(schema.shareLinks).values({
    projectId,
    token,
    label,
    createdBy: user.id,
  });

  revalidatePath(`/admin/projects/${projectId}`);
  redirect(`/admin/projects/${projectId}`);
}

export async function importStoriesCsv(projectId: string, formData: FormData) {
  await requireAdminUser();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    redirect(`/admin/projects/${projectId}?import_error=no_file`);
  }
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    redirect(`/admin/projects/${projectId}?import_error=empty`);
  }

  // Determine the next order_index so imported stories are appended.
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.userStories)
    .where(eq(schema.userStories.projectId, projectId));
  let nextIndex = existing[0]?.count ?? 0;

  const values: Array<typeof schema.userStories.$inferInsert> = [];
  for (const row of rows) {
    const title = (row.title ?? "").trim();
    if (!title) continue;
    const startPathRaw = (row.start_path ?? "/").trim();
    const startPath = validateStartPath(startPathRaw);
    if (startPath === null) continue;
    values.push({
      projectId,
      title,
      description: (row.description ?? "").trim(),
      acceptanceCriteria: (row.acceptance_criteria ?? "").trim(),
      startPath,
      orderIndex: nextIndex++,
    });
  }

  if (values.length === 0) {
    redirect(`/admin/projects/${projectId}?import_error=no_valid_rows`);
  }

  await db.insert(schema.userStories).values(values);
  revalidatePath(`/admin/projects/${projectId}`);
  redirect(`/admin/projects/${projectId}?import_ok=${values.length}`);
}

async function listAllObjectsUnder(
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const sb = supabaseAdmin();
  const all: string[] = [];
  const queue: string[] = [prefix];
  while (queue.length > 0) {
    const p = queue.shift()!;
    const { data, error } = await sb.storage.from(bucket).list(p, { limit: 1000 });
    if (error || !data) continue;
    for (const item of data) {
      const fullPath = `${p}/${item.name}`;
      if (!item.id) queue.push(fullPath); // folder marker
      else all.push(fullPath);
    }
  }
  return all;
}

type BundleUploadResult =
  | { ok: true; uploadPath: string; count: number; generatedIndex: boolean }
  | { ok: false; error: string; detail?: string };

type ZipEntry = {
  entryName: string;
  isDirectory: boolean;
  getData: () => Buffer;
};

// Strip noise entries (macOS metadata, editor junk) that would otherwise skew
// the common-root detection or get uploaded uselessly.
function isNoiseEntry(name: string): boolean {
  return (
    name.startsWith("__MACOSX/") ||
    name.includes("/__MACOSX/") ||
    name.endsWith("/.DS_Store") ||
    name === ".DS_Store" ||
    name.endsWith("/Thumbs.db") ||
    /(^|\/)\._/.test(name)
  );
}

// Longest common directory prefix across all paths. Returns "" (root) if no
// shared wrapping folder. Includes trailing slash when non-empty.
function findCommonDirPrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  const split = paths.map((p) => p.split("/"));
  const common: string[] = [];
  let i = 0;
  while (true) {
    const firstParts = split[0];
    if (i >= firstParts.length - 1) break; // never include the filename itself
    const candidate = firstParts[i];
    const allMatch = split.every((p) => i < p.length - 1 && p[i] === candidate);
    if (!allMatch) break;
    common.push(candidate);
    i++;
  }
  return common.length === 0 ? "" : common.join("/") + "/";
}

function toNiceLabel(filename: string): string {
  const base = filename.replace(/\.html?$/i, "");
  return base
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1))
    .join(" ")
    .trim() || filename;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildGeneratedIndex(htmlRelPaths: string[]): string {
  const items = htmlRelPaths
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map((p) => {
      const filename = p.split("/").pop() ?? p;
      return `      <li><a href="./${escapeHtml(p)}">${escapeHtml(toNiceLabel(filename))}<span class="path">${escapeHtml(p)}</span></a></li>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Wireframe — Übersicht</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #fafafa; color: #111; margin: 0; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
    h1 { margin: 0 0 .25rem; font-size: 1.5rem; letter-spacing: -0.01em; }
    p.lede { color: #555; margin: 0 0 2rem; font-size: .925rem; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
    a { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .875rem 1rem; border: 1px solid #e4e4e7; border-radius: 10px; background: white; color: #111; text-decoration: none; font-weight: 500; }
    a:hover { border-color: #a1a1aa; background: #fafafa; }
    .path { color: #71717a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .75rem; font-weight: 400; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Wireframe-Übersicht</h1>
    <p class="lede">Dieser Index wurde automatisch generiert, weil das hochgeladene Bundle keine <code>index.html</code> enthielt. Klicke eine Seite an.</p>
    <ul>
${items}
    </ul>
  </div>
</body>
</html>
`;
}

async function processWireframeZip(
  projectId: string,
  file: File,
): Promise<BundleUploadResult> {
  if (file.size > 100 * 1024 * 1024) return { ok: false, error: "too_large" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const AdmZip = (await import("adm-zip")).default;
  let entries: ZipEntry[];
  try {
    const zip = new AdmZip(buffer);
    entries = zip
      .getEntries()
      .filter((e) => !e.isDirectory && !isNoiseEntry(e.entryName));
  } catch {
    return { ok: false, error: "invalid_zip" };
  }
  if (entries.length === 0) return { ok: false, error: "empty_zip" };

  // Strategy for locating the entry point:
  //   1. explicit index.html anywhere (shallowest wins)
  //   2. single HTML file in the zip → that file IS the entry
  //   3. multiple HTML files → generate an index.html listing them
  const existingIndex = entries
    .filter((e) => /(^|\/)index\.html?$/i.test(e.entryName))
    .sort(
      (a, b) => a.entryName.split("/").length - b.entryName.split("/").length,
    )[0];
  const htmlEntries = entries.filter((e) => /\.html?$/i.test(e.entryName));
  if (htmlEntries.length === 0) return { ok: false, error: "no_html_files" };

  let indexDir: string;
  let indexFilename: string;
  let generatedIndexHtml: string | null = null;
  let generatedIndex = false;

  if (existingIndex) {
    const slash = existingIndex.entryName.lastIndexOf("/");
    indexDir = slash >= 0 ? existingIndex.entryName.substring(0, slash + 1) : "";
    indexFilename = existingIndex.entryName.substring(slash + 1);
  } else if (htmlEntries.length === 1) {
    const only = htmlEntries[0];
    const slash = only.entryName.lastIndexOf("/");
    indexDir = slash >= 0 ? only.entryName.substring(0, slash + 1) : "";
    indexFilename = only.entryName.substring(slash + 1);
  } else {
    // Multiple HTMLs, no index → synthesize one at the common root.
    indexDir = findCommonDirPrefix(entries.map((e) => e.entryName));
    indexFilename = "index.html";
    generatedIndex = true;
    const rel = htmlEntries
      .filter((e) => e.entryName.startsWith(indexDir))
      .map((e) => e.entryName.substring(indexDir.length))
      .filter((p) => p.length > 0);
    generatedIndexHtml = buildGeneratedIndex(rel);
  }

  const supabase = supabaseAdmin();
  const bucket = env.WIREFRAME_BUCKET;
  const prefix = wireframeProjectPrefix(projectId);

  // Purge previous bundle for this project so uploads don't mix.
  const previous = await listAllObjectsUnder(bucket, prefix);
  if (previous.length > 0) {
    await supabase.storage.from(bucket).remove(previous);
  }

  const uploadables = entries.filter(
    (e) =>
      e.entryName.startsWith(indexDir) &&
      !e.entryName.substring(indexDir.length).includes(".."),
  );
  const CONCURRENCY = 8;
  const errors: string[] = [];
  for (let i = 0; i < uploadables.length; i += CONCURRENCY) {
    const batch = uploadables.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (entry) => {
        const relPath = entry.entryName.substring(indexDir.length);
        if (!relPath) return;
        const key = `${prefix}/${relPath}`;
        const mime = guessContentType(relPath);
        const blob = new Blob([new Uint8Array(entry.getData())], { type: mime });
        const { error } = await supabase.storage.from(bucket).upload(key, blob, {
          contentType: mime,
          upsert: true,
        });
        if (error) errors.push(`${relPath}: ${error.message}`);
      }),
    );
  }

  if (generatedIndexHtml) {
    const key = `${prefix}/${indexFilename}`;
    const mime = "text/html; charset=utf-8";
    const blob = new Blob([generatedIndexHtml], { type: mime });
    const { error } = await supabase.storage.from(bucket).upload(key, blob, {
      contentType: mime,
      upsert: true,
    });
    if (error) errors.push(`${indexFilename} (generated): ${error.message}`);
  }

  if (errors.length > 0) {
    return { ok: false, error: "upload_failed", detail: errors[0] };
  }

  return {
    ok: true,
    uploadPath: `${prefix}/${indexFilename}`,
    count: uploadables.length + (generatedIndexHtml ? 1 : 0),
    generatedIndex,
  };
}

export async function uploadWireframeBundle(
  projectId: string,
  formData: FormData,
) {
  await requireAdminUser();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    redirect(`/admin/projects/${projectId}?upload_error=no_file`);
  }

  const result = await processWireframeZip(projectId, file);
  if (!result.ok) {
    const q = result.detail ? `&detail=${encodeURIComponent(result.detail)}` : "";
    redirect(`/admin/projects/${projectId}?upload_error=${result.error}${q}`);
  }

  await db
    .update(schema.projects)
    .set({ uploadPath: result.uploadPath })
    .where(eq(schema.projects.id, projectId));

  revalidatePath(`/admin/projects/${projectId}`);
  redirect(`/admin/projects/${projectId}?upload_ok=${result.count}`);
}

export async function removeWireframeBundle(projectId: string) {
  await requireAdminUser();
  const supabase = supabaseAdmin();
  const bucket = env.WIREFRAME_BUCKET;
  const prefix = wireframeProjectPrefix(projectId);
  const existing = await listAllObjectsUnder(bucket, prefix);
  if (existing.length > 0) {
    await supabase.storage.from(bucket).remove(existing);
  }
  await db
    .update(schema.projects)
    .set({ uploadPath: null })
    .where(eq(schema.projects.id, projectId));
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  await requireAdminUser();

  // 1. Collect all audio object keys so we can purge them from Storage.
  const audioRows = await db
    .select({ key: schema.feedbackEntries.audioObjectKey })
    .from(schema.feedbackEntries)
    .innerJoin(
      schema.userStories,
      eq(schema.feedbackEntries.userStoryId, schema.userStories.id),
    )
    .where(
      and(
        eq(schema.userStories.projectId, projectId),
        isNotNull(schema.feedbackEntries.audioObjectKey),
      ),
    );
  const keys = audioRows.map((r) => r.key!).filter(Boolean);

  // 2. Best-effort remove audio blobs. If Storage is unreachable we still
  //    delete the DB rows below — stale blobs can be cleaned up later.
  if (keys.length > 0) {
    try {
      await supabaseAdmin().storage.from(env.AUDIO_BUCKET).remove(keys);
    } catch {
      // swallow — DB delete is the source of truth
    }
  }

  // 3. Best-effort remove wireframe bundle, if any.
  try {
    const objs = await listAllObjectsUnder(
      env.WIREFRAME_BUCKET,
      wireframeProjectPrefix(projectId),
    );
    if (objs.length > 0) {
      await supabaseAdmin().storage.from(env.WIREFRAME_BUCKET).remove(objs);
    }
  } catch {
    // swallow — DB delete is the source of truth
  }

  // 4. Cascade-delete via the FKs (user_stories, share_links, etc. all ON DELETE CASCADE).
  await db.delete(schema.projects).where(eq(schema.projects.id, projectId));

  revalidatePath("/admin");
  redirect("/admin");
}

export async function revokeShareLink(projectId: string, shareLinkId: string) {
  await requireAdminUser();
  await db
    .update(schema.shareLinks)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.shareLinks.id, shareLinkId),
        eq(schema.shareLinks.projectId, projectId),
        isNull(schema.shareLinks.revokedAt),
      ),
    );
  revalidatePath(`/admin/projects/${projectId}`);
}
