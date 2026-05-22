import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { captureFeedback } from "@/domain/profiles/profile-operations";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

const feedbackRequestSchema = z.object({
  personId: z.string().min(1).optional(),
  projectKey: z.string().min(2).optional(),
  source: z.string().min(2),
  kind: z.string().min(2),
  summary: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1)).default([])
});

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    const feedback = captureFeedback(runtime.profileOps, feedbackRequestSchema.parse(await request.json()));
    return NextResponse.json({ status: "captured", feedback });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid feedback item", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Feedback capture failed" }, { status: 400 });
  }
}
