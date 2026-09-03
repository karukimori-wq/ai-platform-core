import { describe, expect, it } from "vitest";
import { isCapabilityAllowed, resolveLimit, resolveMonthlyPeriod } from "./plan-usage.js";

describe("plan usage policy", () => {
  it("uses calendar-month periods and resets at the next UTC month boundary", () => {
    const result = resolveMonthlyPeriod(new Date("2026-09-03T03:00:00.000Z"));
    expect(result).toEqual({ period: "2026-09", resetAt: "2026-10-01T00:00:00.000Z" });
  });

  it("recognizes free, pro, and business behavior", () => {
    expect(resolveLimit("free", "studio.report.generate")).toBe(20);
    expect(resolveLimit("pro", "studio.report.generate")).toBeNull();
    expect(resolveLimit("business", "studio.report.generate")).toBeNull();
  });

  it("keeps business capabilities unavailable to free and pro", () => {
    expect(isCapabilityAllowed("free", "business.analytics")).toBe(false);
    expect(isCapabilityAllowed("pro", "business.analytics")).toBe(false);
    expect(isCapabilityAllowed("business", "business.analytics")).toBe(true);
  });

  it("recognizes Numeria Studio and Velvet free AI capabilities", () => {
    expect(isCapabilityAllowed("free", "studio.report.ai_assist")).toBe(true);
    expect(isCapabilityAllowed("free", "velvet.memory.summary")).toBe(true);
    expect(isCapabilityAllowed("free", "velvet.memory.search")).toBe(true);
    expect(isCapabilityAllowed("free", "velvet.memory.recall")).toBe(true);
  });
});
