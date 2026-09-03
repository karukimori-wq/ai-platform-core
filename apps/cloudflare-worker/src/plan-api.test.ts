import { describe, expect, it } from "vitest";
import { getAppEntitlementDefinitions } from "./plan-api.js";


describe("plan API contracts", () => {
  it("exposes Numeria Studio free capabilities with monthly limits", () => {
    const features = getAppEntitlementDefinitions("numeria-studio", "free");
    expect(features).toEqual([
      {
        featureKey: "studio.report.generate",
        allowed: true,
        usagePolicy: "monthly",
        limit: 20,
      },
      {
        featureKey: "studio.report.ai_assist",
        allowed: true,
        usagePolicy: "monthly",
        limit: 20,
      },
    ]);
  });

  it("treats Pro capabilities as unlimited", () => {
    const features = getAppEntitlementDefinitions("velvet", "pro");
    expect(features).toHaveLength(3);
    expect(features.every((feature) => feature.allowed)).toBe(true);
    expect(features.every((feature) => feature.usagePolicy === "unlimited")).toBe(true);
    expect(features.every((feature) => feature.limit === null)).toBe(true);
  });

  it("keeps Business capability availability out of Free and Pro app definitions", () => {
    expect(getAppEntitlementDefinitions("numeria-studio", "free").some((feature) => feature.featureKey.startsWith("business."))).toBe(false);
    expect(getAppEntitlementDefinitions("velvet", "pro").some((feature) => feature.featureKey.startsWith("business."))).toBe(false);
  });
});
