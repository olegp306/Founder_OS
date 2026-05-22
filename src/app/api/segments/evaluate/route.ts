import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { evaluateSegment } from "@/domain/profiles/profile-operations";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

const segmentRequestSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  requiredTags: z.array(z.string().min(1)).min(1)
});

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    const segment = evaluateSegment(runtime.profileOps, segmentRequestSchema.parse(await request.json()));
    return NextResponse.json({ status: "evaluated", segment });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid segment definition", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Segment evaluation failed" }, { status: 400 });
  }
}
