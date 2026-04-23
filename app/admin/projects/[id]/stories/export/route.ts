import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { requireAdminUser } from "@/lib/auth";
import { encodeCsv } from "@/lib/csv";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdminUser();
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, id),
  });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const stories = await db
    .select()
    .from(schema.userStories)
    .where(eq(schema.userStories.projectId, id))
    .orderBy(asc(schema.userStories.orderIndex), asc(schema.userStories.createdAt));

  const csv = encodeCsv(
    ["title", "description", "acceptance_criteria", "start_path"],
    stories.map((s) => ({
      title: s.title,
      description: s.description,
      acceptance_criteria: s.acceptanceCriteria,
      start_path: s.startPath,
    })),
  );

  const safeName = project.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName || "project"}-stories.csv"`,
    },
  });
}
