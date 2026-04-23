import { redirect } from "next/navigation";

export default async function StoryDeepLink({
  params,
}: {
  params: Promise<{ token: string; storyId: string }>;
}) {
  const { token, storyId } = await params;
  redirect(`/r/${token}?story=${storyId}`);
}
