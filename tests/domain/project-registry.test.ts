import { describe, expect, it } from "vitest";
import { registerProject } from "@/domain/projects/project-registry";

describe("project registry", () => {
  it("registers a founder-owned project with repository and production environment", () => {
    const project = registerProject({
      key: "booking_photoshop_studio",
      name: "Booking Photoshop Studio",
      repositoryUrl: "https://github.com/olegp306/booking-photoshop-studio",
      productionUrl: "https://booking.example.com",
      owner: "founder",
      runtime: "nextjs"
    });

    expect(project).toMatchObject({
      key: "booking_photoshop_studio",
      name: "Booking Photoshop Studio",
      status: "active",
      repository: {
        provider: "github",
        defaultBranch: "main"
      },
      environments: [
        {
          kind: "production",
          url: "https://booking.example.com",
          isolation: "founder-shared"
        }
      ]
    });
  });
});
