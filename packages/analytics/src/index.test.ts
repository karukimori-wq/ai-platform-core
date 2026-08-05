import { describe, expect, it } from "vitest";
import { createMemoryKeyValueStore } from "@ai-platform-core/storage";
import { createMemoryAnalyticsRepository, createStoredAnalyticsRepository } from "./index";

describe("analytics repository", () => {
  it("summarizes usage", async () => {
    const analytics = createMemoryAnalyticsRepository();
    await analytics.recordUsage({
      activityId: "activity-1",
      client: "client-a",
      workspaceId: "workspace-1",
      userId: "user-1",
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
    expect(summary.value.byWorkspace["workspace-1"]).toBe(1);
    expect(summary.value.byUser["user-1"]).toBe(1);
    expect(summary.value.byCapability["SNS.Generate"]).toBe(1);
  });

  it("stores usage in key value stores", async () => {
    const usageStore = createMemoryKeyValueStore<{
      readonly activityId: string;
      readonly client: string;
      readonly workspaceId?: string;
      readonly userId?: string;
      readonly ownerUserId?: string;
      readonly capability: string;
      readonly provider: string;
      readonly model: string;
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly totalTokens: number;
      readonly costAmount: number;
      readonly costCurrency: string;
      readonly latencyMs: number;
      readonly occurredAt: string;
    }>();
    const analytics = createStoredAnalyticsRepository({
      usage: usageStore,
      outcomes: createMemoryKeyValueStore(),
      feedback: createMemoryKeyValueStore()
    });

    await analytics.recordUsage({
      activityId: "activity-1",
      client: "fortune_teller_a",
      workspaceId: "workspace-numeria-a",
      userId: "user-fortune-teller-a",
      ownerUserId: "user-fortune-teller-a",
      capability: "report.generate",
      workflow: "numerology",
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 10,
      outputTokens: 15,
      totalTokens: 25,
      costAmount: 0.02,
      costCurrency: "USD",
      latencyMs: 120,
      occurredAt: new Date("2026-08-01T00:00:00.000Z")
    });

    const stored = await usageStore.get("activity-1");
    const usage = await analytics.listUsage();
    const summary = await analytics.summarize();

    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value.value.occurredAt).toBe("2026-08-01T00:00:00.000Z");
    expect(stored.value.value.workspaceId).toBe("workspace-numeria-a");
    expect(stored.value.value.userId).toBe("user-fortune-teller-a");
    expect(usage.ok).toBe(true);
    if (!usage.ok) return;
    expect(usage.value[0]?.occurredAt).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(usage.value[0]?.workspaceId).toBe("workspace-numeria-a");
    expect(usage.value[0]?.userId).toBe("user-fortune-teller-a");
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    expect(summary.value.byClient.fortune_teller_a).toBe(1);
  });
});
