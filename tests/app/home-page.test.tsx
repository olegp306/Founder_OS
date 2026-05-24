import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("Founder OS home page", () => {
  afterEach(() => {
    delete process.env.FOUNDER_OS_ENABLE_DASHBOARD_DEMO;
  });

  it("surfaces the AI execution control dashboard", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("AI Execution Control");
    expect(html).toContain("Tokens under risk");
    expect(html).toContain("Downgrade rate");
    expect(html).toContain("/api/ai-execution/decide");
    expect(html).toContain("/api/ai-execution/summary");
    expect(html).toContain("/api/projects/connection");
    expect(html).toContain("/api/projects/ai-setup");
    expect(html).toContain("Connection Bundle");
    expect(html).toContain("Project Transfer Readiness");
    expect(html).toContain("Connected Projects");
    expect(html).toContain("Transfer Flow");
    expect(html).toContain("projects:transfer");
    expect(html).toContain("Token Spend");
    expect(html).toContain("AI Key Inventory");
    expect(html).toContain("Key Lifecycle");
    expect(html).toContain("Production keys");
    expect(html).toContain("Rotation due");
    expect(html).toContain("Launch Gate");
    expect(html).toContain("Dashboard demo");
    expect(html).toContain("Persistence");
    expect(html).toContain("Key references");
    expect(html).toContain("Provider budgets");
    expect(html).toContain("Bulk Token Policy");
    expect(html).toContain("/api/token-policy/bulk");
    expect(html).toContain("cost_spike_or_provider_incident");
    expect(html).toContain("bulk-token-policy.json");
    expect(html).toContain("Token policy");
    expect(html).toContain("No raw prompts");
    expect(html).toContain("No secret refs");
    expect(html).toContain("No execution decisions recorded for booking_assistant");
  });

  it("can seed safe local demo AI execution signals when explicitly enabled", async () => {
    process.env.FOUNDER_OS_ENABLE_DASHBOARD_DEMO = "true";

    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("Execution decisions");
    expect(html).toContain("4.5k");
    expect(html).toContain("6/6");
    expect(html).toContain("$1.20");
    expect(html).toContain("Projected daily");
    expect(html).toContain("AI Key Inventory");
    expect(html).toContain("Key Lifecycle");
    expect(html).toContain("Launch Gate");
    expect(html).toContain("$250.00");
    expect(html).toContain("gpt-5.4-mini");
    expect(html).toContain("Bulk Token Policy");
    expect(html).toContain("Emergency mode");
    expect(html).toContain("prompt_injection_or_system_extraction");
    expect(html).not.toContain("demo-secret-ref");
    expect(html).not.toContain("world history");
  });
});
