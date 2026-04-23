export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function joinWireframeUrl(baseUrl: string, startPath: string): string {
  if (!startPath) return baseUrl;
  try {
    if (startPath.startsWith("#") || startPath.startsWith("?")) {
      return `${baseUrl}${startPath}`;
    }
    // If the base looks like a file (e.g. ends with index.html), keep it as-is
    // so standard URL resolution strips the filename. Otherwise treat it as a
    // directory by ensuring a trailing slash.
    const base = looksLikeFileUrl(baseUrl)
      ? baseUrl
      : baseUrl.endsWith("/")
        ? baseUrl
        : `${baseUrl}/`;
    // Drop leading slash(es) on the start_path so it's always resolved
    // relative to the base URL (not the origin root).
    const relative = startPath.replace(/^\/+/, "");
    return new URL(relative || "", base).toString();
  } catch {
    return baseUrl;
  }
}

function looksLikeFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const lastSeg = parsed.pathname.split("/").pop() ?? "";
    return /\.[a-z0-9]{1,6}$/i.test(lastSeg);
  } catch {
    return false;
  }
}

export function validateStartPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  if (/\s/.test(trimmed)) return null;
  if (/^https?:/i.test(trimmed)) return null; // disallow absolute URLs to other origins
  return trimmed;
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("de-DE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
