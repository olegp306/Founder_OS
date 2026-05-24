import { describe, expect, it } from "vitest";
import {
  InMemoryProjectOnboardingStore,
  onboardProjectManifest,
  registerAiKeyReference,
  resolveProjectAiControl
} from "@/domain/projects/project-onboarding";

describe("project onboarding and AI controls", () => {
  it("onboards a Founder OS project manifest into registry records", () => {
    const store = new InMemoryProjectOnboardingStore();

    const result = onboardProjectManifest(store, {
      project_id: "booking_assistant",
      name: "Booking Assistant",
      status: "active",
      category: "booking",
      owner: "olegp306",
      workspace: "C:\\repos\\booking-assistant",
      repository: {
        provider: "github",
        name: "olegp306/booking-assistant",
        local_path: "C:\\repos\\booking-assistant"
      },
      assistant: {
        enabled: true,
        token_tracking_required: true,
        feedback_capture_required: true
      },
      user_data: {
        raw_message_storage: "disabled_by_default",
        consent_required_for_marketing: true
      }
    });

    expect(result.project).toMatchObject({
      key: "booking_assistant",
      name: "Booking Assistant",
      status: "active",
      owner: "olegp306"
    });
    expect(result.repository).toMatchObject({
      provider: "github",
      name: "olegp306/booking-assistant"
    });
    expect(result.controls).toMatchObject({
      assistantEnabled: true,
      tokenTrackingRequired: true,
      rawMessageStorage: "disabled_by_default"
    });
  });

  it("registers AI key references without storing plaintext secret values", () => {
    const store = new InMemoryProjectOnboardingStore();

    const key = registerAiKeyReference(store, {
      projectKey: "booking_assistant",
      provider: "openai",
      secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
      displayName: "Booking Assistant OpenAI key",
      allowedModels: ["gpt-5.4-mini", "gpt-5.4"],
      defaultModel: "gpt-5.4-mini",
      monthlyBudgetUsd: 250,
      plaintextSecret: "sk-should-never-be-stored"
    });

    expect(key).toEqual({
      projectKey: "booking_assistant",
      provider: "openai",
      secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
      displayName: "Booking Assistant OpenAI key",
      allowedModels: ["gpt-5.4-mini", "gpt-5.4"],
      defaultModel: "gpt-5.4-mini",
      monthlyBudgetUsd: 250,
      environment: "production",
      rotationDueAt: undefined,
      lastVerifiedAt: undefined,
      status: "active"
    });
    expect(JSON.stringify(store.aiKeysForProject("booking_assistant"))).not.toContain(
      "sk-should-never-be-stored"
    );
  });

  it("resolves project AI control with model fallback and budget metadata", () => {
    const store = new InMemoryProjectOnboardingStore();
    registerAiKeyReference(store, {
      projectKey: "booking_assistant",
      provider: "openai",
      secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
      displayName: "Booking Assistant OpenAI key",
      allowedModels: ["gpt-5.4-mini", "gpt-5.4"],
      defaultModel: "gpt-5.4-mini",
      monthlyBudgetUsd: 250
    });

    expect(
      resolveProjectAiControl(store, {
        projectKey: "booking_assistant",
        requestedModel: "gpt-5.4"
      })
    ).toEqual({
      allowed: true,
      provider: "openai",
      model: "gpt-5.4",
      secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
      monthlyBudgetUsd: 250,
      reasons: []
    });

    expect(
      resolveProjectAiControl(store, {
        projectKey: "booking_assistant",
        requestedModel: "gpt-unknown"
      })
    ).toEqual({
      allowed: true,
      provider: "openai",
      model: "gpt-5.4-mini",
      secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
      monthlyBudgetUsd: 250,
      reasons: ["requested_model_not_allowed"]
    });
  });
});
