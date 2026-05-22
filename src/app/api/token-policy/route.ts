import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

const tokenPolicyRequestSchema = z.object({
  projectKey: z.string().min(2),
  assistantKey: z.string().min(2).optional(),
  preferredModel: z.string().min(2),
  fallbackModel: z.string().min(2),
  dailyBudgetUsd: z.number().min(0),
  monthlyBudgetUsd: z.number().min(0),
  maxTokensPerRequest: z.number().int().min(1),
  emergencyMode: z.boolean().default(false)
});

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const projectKey = request.nextUrl.searchParams.get("projectKey");
  const assistantKey = request.nextUrl.searchParams.get("assistantKey") ?? undefined;

  if (!projectKey) {
    return NextResponse.json({ error: "projectKey is required" }, { status: 400 });
  }

  const policy = runtime.tokens.findPolicy({ projectKey, assistantKey });

  if (!policy) {
    return NextResponse.json({ error: "Token policy not found" }, { status: 404 });
  }

  return NextResponse.json({ policy });
}

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    const policy = runtime.tokens.setPolicy(tokenPolicyRequestSchema.parse(await request.json()));
    return NextResponse.json({ status: "saved", policy });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid token policy",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Token policy save failed" }, { status: 400 });
  }
}
