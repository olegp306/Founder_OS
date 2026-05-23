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
    expect(body.privateMvpReadiness.projectConnectionBundle).toBe(true);
    expect(body.privateMvpReadiness.projectAiSetup).toBe(true);
    expect(body.privateMvpReadiness.projectList).toBe(true);
    expect(body.privateMvpReadiness.aiKeyInventory).toBe(true);
  });
});
