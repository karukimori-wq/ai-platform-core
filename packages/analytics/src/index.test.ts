import { describe, expect, it } from "vitest";
import { createMemoryAnalyticsRepository } from "./index";

describe("analytics repository", () => {
  it("summarizes usage", async () => {
    const analytics = createMemoryAnalyticsRepository();
    await analytics.recordUsage({
      activityId: "activity-1",
      client: "client-a",
      capability: "SNS.Generate",
      provider: "echo",
      model: "test",
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      costAmount: 0.01,
      costCurrency: "USD",
      latencyMs: 10,
      occurredAt: new Date()
    });
    const summary = await analytics.summarize();
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    expect(summary.value.totalTokens).toBe(3);
    expect(summary.value.byCapability["SNS.Generate"]).toBe(1);
  });
});
