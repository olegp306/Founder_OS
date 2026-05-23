import {
  type NormalizedTokenUsageEvent,
  type TokenUsageInput,
  normalizeTokenUsageEvent,
  summarizeTokenBurnRate
} from "@/domain/token-control/token-control";

export type TokenPolicyRecord = {
  projectKey: string;
  assistantKey?: string;
  preferredModel: string;
  fallbackModel: string;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  maxTokensPerRequest: number;
  emergencyMode: boolean;
};

export type SafeTokenPolicy = {
  projectKey: string;
  preferredModel: string;
  fallbackModel: string;
  maxTokensPerRequest: number;
  emergencyMode: boolean;
};

export type TokenAlert = {
  kind: "budget" | "burn_rate" | "anomaly" | "policy_breach";
  message: string;
};

export class InMemoryTokenControlStore {
  private readonly usage: NormalizedTokenUsageEvent[] = [];
  private readonly policies = new Map<string, TokenPolicyRecord>();

  recordUsage(usage: NormalizedTokenUsageEvent): NormalizedTokenUsageEvent {
    this.usage.push(usage);
    return usage;
  }

  usageForProject(projectKey: string): NormalizedTokenUsageEvent[] {
    return this.usage.filter((usage) => usage.projectKey === projectKey);
  }

  setPolicy(policy: TokenPolicyRecord): TokenPolicyRecord {
    this.policies.set(policyKey(policy.projectKey, policy.assistantKey), policy);
    return policy;
  }

  findPolicy(input: { projectKey: string; assistantKey?: string }): TokenPolicyRecord | undefined {
    return (
      this.policies.get(policyKey(input.projectKey, input.assistantKey)) ??
      this.policies.get(policyKey(input.projectKey))
    );
  }
}

export function recordTokenUsage(
  store: InMemoryTokenControlStore,
  input: TokenUsageInput
): NormalizedTokenUsageEvent {
  return store.recordUsage(normalizeTokenUsageEvent(input));
}

export function assessTokenSpend(input: {
  store: InMemoryTokenControlStore;
  policy: TokenPolicyRecord;
  windowHours: number;
}): { alerts: TokenAlert[] } {
  const usage = input.store.usageForProject(input.policy.projectKey);
  const burnRate = summarizeTokenBurnRate({
    windowHours: input.windowHours,
    events: usage.map((event) => ({
      costUsd: event.costUsd,
      totalTokens: event.totalTokens
    }))
  });

  if (burnRate.projectedDailySpendUsd > input.policy.dailyBudgetUsd) {
    return {
      alerts: [
        {
          kind: "burn_rate",
          message: `Projected daily spend $${burnRate.projectedDailySpendUsd.toFixed(2)} exceeds daily budget $${input.policy.dailyBudgetUsd.toFixed(2)}`
        }
      ]
    };
  }

  return { alerts: [] };
}

export function getSafeTokenPolicy(input: {
  activePolicy?: SafeTokenPolicy;
  lastKnownSafePolicy: SafeTokenPolicy;
  requestedTokens: number;
}): {
  allowed: boolean;
  model: string;
  source: "active_policy" | "last_known_safe_policy";
  reasons: string[];
} {
  const policy = input.activePolicy ?? input.lastKnownSafePolicy;
  const reasons = input.activePolicy ? [] : ["central_policy_unavailable"];

  if (input.requestedTokens > policy.maxTokensPerRequest) {
    return {
      allowed: false,
      model: policy.fallbackModel,
      source: input.activePolicy ? "active_policy" : "last_known_safe_policy",
      reasons: [...reasons, "request_token_limit_exceeded"]
    };
  }

  return {
    allowed: true,
    model: policy.emergencyMode ? policy.fallbackModel : policy.preferredModel,
    source: input.activePolicy ? "active_policy" : "last_known_safe_policy",
    reasons: policy.emergencyMode ? [...reasons, "emergency_mode"] : reasons
  };
}

function policyKey(projectKey: string, assistantKey = "*"): string {
  return `${projectKey}:${assistantKey}`;
}
