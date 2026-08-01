import { createMemoryAnalyticsRepository } from "@ai-platform-core/analytics";
import { describe, expect, it } from "vitest";
import { createDashboardQueryService } from "./index";

describe("dashboard query service", () => {
  it("builds period and grouping metrics", async () => {
    const analytics = createMemoryAnalyticsRepository();
    await analytics.recordUsage({
      activityId: "activity-1",
      client: "client-a",
      capability: "SNS.Generate",
      provider: "echo",
      model: "test",
      inputTokens: 3,
      outputTokens: 7,
      totalTokens: 10,
      costAmount: 0.2,
      costCurrency: "USD",
      latencyMs: 100,
      occurredAt: new Date("2026-08-02T10:00:00.000Z")
    });
    const dashboard = createDashboardQueryService(analytics, { now: () => new Date("2026-08-02T12:00:00.000Z") });
    const view = await dashboard.getView({ period: "today" });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.metric.totalTokens).toBe(10);
    expect(view.value.byClient["client-a"]?.usageCount).toBe(1);
  });
});
