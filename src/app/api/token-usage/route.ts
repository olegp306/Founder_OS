import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { recordTokenUsage } from "@/domain/token-control/token-control-service";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

const tokenUsageRequestSchema = z.object({
  projectKey: z.string().min(2),
  assistantKey: z.string().min(2),
  environment: z.enum(["local", "staging", "production", "client-isolated"]),
  model: z.string().min(2),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
  occurredAt: z.string().datetime()
});

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    const payload = tokenUsageRequestSchema.parse(await request.json());
    const usage = recordTokenUsage(runtime.tokens, payload);
    const policy = runtime.tokens.findPolicy({
      projectKey: usage.projectKey,
      assistantKey: usage.assistantKey
    });

    return NextResponse.json({
      status: "recorded",
      usage,
      policy: policy
        ? {
            preferredModel: policy.preferredModel,
            fallbackModel: policy.fallbackModel,
            emergencyMode: policy.emergencyMode,
            maxTokensPerRequest: policy.maxTokensPerRequest
          }
        : null
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid token usage event",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Token usage recording failed" }, { status: 400 });
  }
}
