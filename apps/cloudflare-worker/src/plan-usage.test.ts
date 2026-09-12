import { describe, expect, it } from "vitest";
import {
  BUSINESS_PURCHASABLE,
  BUSINESS_RELEASE_STATUS,
  isCapabilityAllowed,
  resolveLimit,
  resolveMonthlyPeriod,
} from "./plan-usage.js";

describe("plan usage policy", () => {
  it("uses calendar-month periods and resets at the next UTC month boundary", () => {
    const result = resolveMonthlyPeriod(new Date("2026-09-03T03:00:00.000Z"));
    expect(result).toEqual({ period: "2026-09", resetAt: "2026-10-01T00:00:00.000Z" });
  });

  it("does not invent numeric AI-call limits absent from the shared contract", () => {
    expect(resolveLimit("free", "studio.report.generate")).toBeNull();
    expect(resolveLimit("free", "studio.report.ai_assist")).toBeNull();
    expect(resolveLimit("pro", "velvet.ai.organize_suggest")).toBeNull();
  });

  it("keeps Business defined but unavailable during the Free Pro release", () => {
    expect(BUSINESS_RELEASE_STATUS).toBe("unavailable");
    expect(BUSINESS_PURCHASABLE).toBe(false);
    expect(isCapabilityAllowed("free", "business.analytics")).toBe(false);
    expect(isCapabilityAllowed("pro", "business.analytics")).toBe(false);
    expect(isCapabilityAllowed("business", "business.analytics")).toBe(false);
    expect(isCapabilityAllowed("business", "studio.report.ai_assist")).toBe(false);
  });

  it("allows Free-tier Numeria AI assistance without reusing the appraisal completion limit", () => {
    expect(isCapabilityAllowed("free", "studio.report.ai_assist")).toBe(true);
    expect(isCapabilityAllowed("pro", "studio.report.ai_assist")).toBe(true);
  });

  it("keeps canonical Pro AI features Pro-only", () => {
    expect(isCapabilityAllowed("free", "numeria.report.wording_adjustment")).toBe(false);
    expect(isCapabilityAllowed("pro", "numeria.report.wording_adjustment")).toBe(true);
    expect(isCapabilityAllowed("free", "velvet.ai.organize_suggest")).toBe(false);
    expect(isCapabilityAllowed("pro", "velvet.ai.organize_suggest")).toBe(true);
  });

  it("keeps legacy Velvet AI keys as Pro-only compatibility aliases", () => {
    for (const featureKey of ["velvet.memory.summary", "velvet.memory.search", "velvet.memory.recall"]) {
      expect(isCapabilityAllowed("free", featureKey)).toBe(false);
      expect(isCapabilityAllowed("pro", featureKey)).toBe(true);
    }
  });
});
