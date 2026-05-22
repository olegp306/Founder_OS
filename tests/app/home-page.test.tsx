import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("Founder OS home page", () => {
  it("surfaces the AI execution control dashboard", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("AI Execution Control");
    expect(html).toContain("Tokens under risk");
    expect(html).toContain("Downgrade rate");
    expect(html).toContain("/api/ai-execution/decide");
    expect(html).toContain("/api/ai-execution/summary");
    expect(html).toContain("No raw prompts");
    expect(html).toContain("No secret refs");
  });
});
