export type AiUsageRequestAssessmentInput = {
  projectKey: string;
  assistantKey: string;
  userRef?: string;
  productScope: string;
  requestSummary: string;
  requestedModel: string;
  estimatedTokens: number;
  recentRequestsInHour: number;
};

export type AiUsageRiskLevel = "low" | "medium" | "high" | "critical";

export type AiUsageRecommendedAction =
  | "allow"
  | "downgrade"
  | "rate_limit"
  | "block"
  | "temporary_suspend";

export type AiUsageAssessment = {
  allowed: boolean;
  riskLevel: AiUsageRiskLevel;
  recommendedAction: AiUsageRecommendedAction;
  modelDirective: "requested" | "fallback" | "none";
  reasons: string[];
  userFacingResponse: string;
};

const userFacingResponse =
  "I can help with supported product tasks, but cannot help with unrelated or abusive use.";

const genericProxyPatterns = [
  "generic essay",
  "homework",
  "world history",
  "unrelated",
  "seo articles",
  "scrape"
];

const promptInjectionPatterns = [
  "ignore previous instructions",
  "system prompt",
  "hidden policy",
  "api keys",
  "reveal your"
];

const bulkPatterns = ["bulk", "hundreds", "automation", "scrape"];

export function assessAiUsageRequest(input: AiUsageRequestAssessmentInput): AiUsageAssessment {
  const reasons = detectRiskReasons(input);

  if (reasons.includes("high_volume_low_product_intent")) {
    return assessment({
      allowed: false,
      riskLevel: "critical",
      recommendedAction: "temporary_suspend",
      modelDirective: "none",
      reasons
    });
  }

  if (reasons.includes("prompt_injection_or_system_extraction")) {
    return assessment({
      allowed: false,
      riskLevel: "high",
      recommendedAction: "block",
      modelDirective: "none",
      reasons
    });
  }

  if (reasons.includes("bulk_or_automation_pattern")) {
    return assessment({
      allowed: true,
      riskLevel: "high",
      recommendedAction: "rate_limit",
      modelDirective: "fallback",
      reasons
    });
  }

  if (reasons.length > 0) {
    return assessment({
      allowed: true,
      riskLevel: "medium",
      recommendedAction: "downgrade",
      modelDirective: "fallback",
      reasons
    });
  }

  return assessment({
    allowed: true,
    riskLevel: "low",
    recommendedAction: "allow",
    modelDirective: "requested",
    reasons: []
  });
}

function detectRiskReasons(input: AiUsageRequestAssessmentInput): string[] {
  const request = input.requestSummary.toLowerCase();
  const productScope = input.productScope.toLowerCase();
  const reasons: string[] = [];
  const isPromptAttack = containsAny(request, promptInjectionPatterns);

  if (!isPromptAttack && !sharesProductScope(request, productScope)) {
    reasons.push("outside_product_scope");
  }

  if (containsAny(request, genericProxyPatterns)) {
    reasons.push("generic_ai_proxy_pattern");
  }

  if (isPromptAttack) {
    reasons.push("prompt_injection_or_system_extraction");
  }

  if (containsAny(request, bulkPatterns) || input.estimatedTokens > 20_000) {
    reasons.push("bulk_or_automation_pattern");
  }

  if (
    input.recentRequestsInHour >= 60 &&
    (reasons.includes("outside_product_scope") || reasons.includes("generic_ai_proxy_pattern"))
  ) {
    reasons.push("high_volume_low_product_intent");
  }

  return reasons;
}

function sharesProductScope(request: string, productScope: string): boolean {
  const scopeWords = productScope
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length >= 5)
    .map((word) => word.toLowerCase());

  return scopeWords.some((word) => request.includes(word));
}

function containsAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

function assessment(input: Omit<AiUsageAssessment, "userFacingResponse">): AiUsageAssessment {
  return {
    ...input,
    userFacingResponse
  };
}
