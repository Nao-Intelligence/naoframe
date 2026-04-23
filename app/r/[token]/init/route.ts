import { NextResponse, type NextRequest } from "next/server";
import {
  getOrCreateReviewerSession,
  resolveShareToken,
} from "@/lib/review-session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const resolved = await resolveShareToken(token);
  if (!resolved) return new NextResponse("Not found", { status: 404 });

  // Writes the reviewer-session cookie — allowed in a Route Handler.
  await getOrCreateReviewerSession(resolved.shareLink.id);

  const storyParam = request.nextUrl.searchParams.get("story");
  const redirectUrl = new URL(`/r/${token}`, request.nextUrl.origin);
  if (storyParam) redirectUrl.searchParams.set("story", storyParam);
  return NextResponse.redirect(redirectUrl);
}
