import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("health route", () => {
  it("reports project connection bundle as a service-backed route", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.serviceBackedRoutes).toContain("/api/projects/connection");
    expect(body.serviceBackedRoutes).toContain("/api/projects/ai-setup");
    expect(body.serviceBackedRoutes).toContain("/api/projects");
    expect(body.serviceBackedRoutes).toContain("/api/ai-keys");
    expect(body.serviceBackedRoutes).toContain("/api/provider-spend/import");
    expect(body.serviceBackedRoutes).toContain("/api/alerts");
    expect(body.serviceBackedRoutes).toContain("/api/campaigns/telegram-live-send/approve");
    expect(body.repositoryBackedRoutes).toContain("/api/token-policy/bulk");
    expect(body.privateMvpReadiness.projectConnectionBundle).toBe(true);
    expect(body.privateMvpReadiness.projectAiSetup).toBe(true);
    expect(body.privateMvpReadiness.projectList).toBe(true);
    expect(body.privateMvpReadiness.aiKeyInventory).toBe(true);
    expect(body.privateMvpReadiness.bulkTokenPolicy).toBe(true);
    expect(body.privateMvpReadiness.providerSpendImport).toBe(true);
    expect(body.privateMvpReadiness.alertEvidence).toBe(true);
    expect(body.privateMvpReadiness.campaignLiveSendApproval).toBe(true);
  });
});
