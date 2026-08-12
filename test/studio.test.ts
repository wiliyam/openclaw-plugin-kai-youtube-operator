import { describe, expect, it } from "vitest";
import { buildLivePlan, studioCapabilities } from "../src/index.js";

describe("studio helpers", () => {
  it("builds safe live plans with approval checkpoints", () => {
    const plan = buildLivePlan({ goal: "go_live", title: "Test stream" });

    expect(plan.approvalRequiredBefore).toContain("transitioning a broadcast to testing, live, or complete");
    expect(plan.plan.join(" ")).toContain("stream health");
  });

  it("documents broad Studio API capabilities and boundaries", () => {
    const capabilities = studioCapabilities();

    expect(capabilities.apiBacked.join(" ")).toContain("Video search");
    expect(capabilities.apiBacked.join(" ")).toContain("Live stream");
    expect(capabilities.notApiBacked.join(" ")).toContain("Studio-only");
  });
});
