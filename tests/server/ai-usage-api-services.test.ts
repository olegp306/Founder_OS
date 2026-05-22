import { describe, expect, it } from "vitest";
import { createFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleAiUsageAssessment } from "@/server/project-ai-api-services";

describe("AI usage API services", () => {
  it("assesses AI usage requests and returns enforcement guidance", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });

    await expect(
      handleAiUsageAssessment(runtime, {
        projectKey: "booking_assistant",
        assistantKey: "support_bot",
        userRef: "telegram:123",
        productScope: "Photo studio booking automation and customer support",
        requestSummary: "Write a generic essay about world history and answer unrelated homework questions.",
        requestedModel: "gpt-5.4",
        estimatedTokens: 3000,
        recentRequestsInHour: 4
      })
    ).resolves.toEqual({
      status: "assessed",
      assessment: {
        allowed: true,
        riskLevel: "medium",
        recommendedAction: "downgrade",
        modelDirective: "fallback",
        reasons: ["outside_product_scope", "generic_ai_proxy_pattern"],
        userFacingResponse:
          "I can help with supported product tasks, but cannot help with unrelated or abusive use."
      }
    });
  });

  it("rejects malformed assessment payloads", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });

    await expect(
      handleAiUsageAssessment(runtime, {
        projectKey: "booking_assistant",
        requestSummary: "missing fields"
      })
    ).rejects.toThrow();
  });
});
