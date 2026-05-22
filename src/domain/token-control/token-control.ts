export type TokenUsageInput = {
  projectKey: string;
  assistantKey: string;
  environment: "local" | "staging" | "production" | "client-isolated";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  occurredAt: string;
};

export type NormalizedTokenUsageEvent = TokenUsageInput & {
  totalTokens: number;
  costPerThousandTokensUsd: number;
  policySubject: string;
};

export type TokenPolicyInput = {
  preferredModel: string;
  fallbackModel: string;
  emergencyMode: boolean;
  dailyBudgetUsd: number;
  spentTodayUsd: number;
  maxTokensPerRequest: number;
  requestedTokens: number;
};

export type TokenPolicyDecision = {
  allowed: boolean;
  model: string;
  action: "allow" | "downgrade" | "block";
  reasons: string[];
};

export type BurnRateInput = {
  windowHours: number;
  events: Array<{
    costUsd: number;
    totalTokens: number;
  }>;
};

export type BurnRateSummary = {
  spendPerHourUsd: number;
  tokensPerHour: number;
  projectedDailySpendUsd: number;
};

export function normalizeTokenUsageEvent(input: TokenUsageInput): NormalizedTokenUsageEvent {
  const totalTokens = input.inputTokens + input.outputTokens;

  return {
    ...input,
    totalTokens,
    costPerThousandTokensUsd: totalTokens === 0 ? 0 : input.costUsd / (totalTokens / 1000),
    policySubject: `project:${input.projectKey}`
  };
}

export function evaluateTokenPolicy(input: TokenPolicyInput): TokenPolicyDecision {
  if (input.spentTodayUsd >= input.dailyBudgetUsd) {
    return {
      allowed: false,
      model: input.fallbackModel,
      action: "block",
      reasons: ["daily_budget_exhausted"]
    };
  }

  if (input.requestedTokens > input.maxTokensPerRequest) {
    return {
      allowed: false,
      model: input.fallbackModel,
      action: "block",
      reasons: ["request_token_limit_exceeded"]
    };
  }

  if (input.emergencyMode) {
    return {
      allowed: true,
      model: input.fallbackModel,
      action: "downgrade",
      reasons: ["emergency_mode"]
    };
  }

  return {
    allowed: true,
    model: input.preferredModel,
    action: "allow",
    reasons: []
  };
}

export function summarizeTokenBurnRate(input: BurnRateInput): BurnRateSummary {
  const totalSpend = input.events.reduce((sum, event) => sum + event.costUsd, 0);
  const totalTokens = input.events.reduce((sum, event) => sum + event.totalTokens, 0);

  return {
    spendPerHourUsd: totalSpend / input.windowHours,
    tokensPerHour: totalTokens / input.windowHours,
    projectedDailySpendUsd: (totalSpend / input.windowHours) * 24
  };
}
