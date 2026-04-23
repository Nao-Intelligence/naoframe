import { env } from "./env";

export function wireframeProjectPrefix(projectId: string): string {
  return `proj-${projectId}`;
}

export function wireframePublicUrl(uploadPath: string): string {
  // Served via our own proxy (/wireframes/<projectId>/<rest>) — we can't use
  // Supabase's public URLs directly because they send a restrictive CSP
  // (default-src 'none'; sandbox) that blocks HTML rendering + JS execution.
  const match = uploadPath.match(/^proj-([^/]+)\/(.+)$/);
  if (!match) return "";
  const [, projectId, rest] = match;
  return `${env.APP_URL}/wireframes/${projectId}/${rest}`;
}

export function resolveWireframeBaseUrl(project: {
  baseWireframeUrl: string | null;
  uploadPath: string | null;
}): string | null {
  if (project.uploadPath) return wireframePublicUrl(project.uploadPath);
  return project.baseWireframeUrl;
}

export function guessContentType(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.substring(dot + 1).toLowerCase() : "";
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    eot: "application/vnd.ms-fontobject",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    txt: "text/plain; charset=utf-8",
    xml: "application/xml",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}
