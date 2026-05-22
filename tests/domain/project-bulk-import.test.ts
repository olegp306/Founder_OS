import { describe, expect, it } from "vitest";
import {
  InMemoryProjectOnboardingStore,
  registerAiKeyReference
} from "@/domain/projects/project-onboarding";
import {
  buildProjectImportReadiness,
  importProjectManifests
} from "@/domain/projects/project-bulk-import";

describe("project bulk import", () => {
  it("imports valid manifests and reports invalid manifests without stopping the batch", () => {
    const store = new InMemoryProjectOnboardingStore();

    const report = importProjectManifests(store, [
      {
        path: "C:\\repos\\booking-assistant\\.founderos\\project.json",
        content: JSON.stringify({
          project_id: "booking_assistant",
          name: "Booking Assistant",
          status: "active",
          category: "booking",
          owner: "olegp306",
          repository: {
            provider: "github",
            name: "olegp306/booking-assistant"
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
        })
      },
      {
        path: "C:\\repos\\broken\\.founderos\\project.json",
        content: "{not-json"
      }
    ]);

    expect(report).toEqual({
      imported: [
        {
          projectKey: "booking_assistant",
          name: "Booking Assistant",
          manifestPath: "C:\\repos\\booking-assistant\\.founderos\\project.json"
        }
      ],
      skipped: [],
      invalid: [
        {
          manifestPath: "C:\\repos\\broken\\.founderos\\project.json",
          reason: "invalid_json"
        }
      ]
    });
  });

  it("skips manifests that are missing required project identity fields", () => {
    const store = new InMemoryProjectOnboardingStore();

    const report = importProjectManifests(store, [
      {
        path: "C:\\repos\\missing\\.founderos\\project.json",
        content: JSON.stringify({
          name: "Missing Project ID",
          owner: "olegp306"
        })
      }
    ]);

    expect(report.imported).toEqual([]);
    expect(report.skipped).toEqual([
      {
        manifestPath: "C:\\repos\\missing\\.founderos\\project.json",
        reason: "missing_required_fields"
      }
    ]);
  });

  it("builds readiness for imported projects and AI key references", () => {
    const store = new InMemoryProjectOnboardingStore();
    importProjectManifests(store, [
      {
        path: "C:\\repos\\booking-assistant\\.founderos\\project.json",
        content: JSON.stringify({
          project_id: "booking_assistant",
          name: "Booking Assistant",
          status: "active",
          owner: "olegp306",
          assistant: {
            enabled: true,
            token_tracking_required: true,
            feedback_capture_required: true
          },
          user_data: {
            raw_message_storage: "disabled_by_default",
            consent_required_for_marketing: true
          }
        })
      }
    ]);
    registerAiKeyReference(store, {
      projectKey: "booking_assistant",
      provider: "openai",
      secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
      displayName: "Booking Assistant OpenAI key",
      allowedModels: ["gpt-5.4-mini"],
      defaultModel: "gpt-5.4-mini",
      monthlyBudgetUsd: 250
    });

    expect(buildProjectImportReadiness(store, ["booking_assistant"])).toEqual([
      {
        projectKey: "booking_assistant",
        manifestImported: true,
        aiKeyConfigured: true,
        tokenTrackingRequired: true,
        feedbackCaptureRequired: true,
        rawMessageStorage: "disabled_by_default"
      }
    ]);
  });
});
