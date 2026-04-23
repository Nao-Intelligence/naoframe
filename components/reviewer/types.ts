export type ReviewStory = {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  startPath: string;
};

export type ReviewProject = {
  id: string;
  name: string;
  clientName: string | null;
  baseWireframeUrl: string;
};

export type ReviewDecision = {
  storyId: string;
  status: "accepted" | "rejected";
  decidedAt: string;
};

export type ReviewFeedback = {
  id: string;
  storyId: string;
  kind: "text" | "audio";
  body: string;
  createdAt: string;
};

export function latestDecision(
  storyId: string,
  decisions: ReviewDecision[],
): ReviewDecision | null {
  const filtered = decisions
    .filter((d) => d.storyId === storyId)
    .sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : -1));
  return filtered[0] ?? null;
}
