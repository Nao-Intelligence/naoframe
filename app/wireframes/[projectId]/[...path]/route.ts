import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { guessContentType, wireframeProjectPrefix } from "@/lib/wireframe";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; path: string[] }> },
) {
  const { projectId, path } = await params;
  if (!path || path.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }
  // Prevent path-traversal.
  if (path.some((seg) => seg === ".." || seg === "" || seg.startsWith(".."))) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const storageKey = `${wireframeProjectPrefix(projectId)}/${path.join("/")}`;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.storage
    .from(env.WIREFRAME_BUCKET)
    .download(storageKey);
  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const arrayBuffer = await data.arrayBuffer();
  const filename = path[path.length - 1];
  const contentType = guessContentType(filename);

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Short cache so bundle re-uploads are visible quickly.
      "Cache-Control": "private, max-age=30",
      // No Content-Security-Policy — we serve from our own origin into our
      // own iframe, the reviewer UI. Override the restrictive Supabase default.
    },
  });
}
