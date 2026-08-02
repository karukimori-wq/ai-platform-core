import { createMemoryAnalyticsRepository } from "@ai-platform-core/analytics";
import { createClientRegistry } from "@ai-platform-core/client";
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
    await analytics.recordOutcome({
      activityId: "activity-1",
      result: "published",
      score: 0.8,
      roi: 1.5
    });
    await analytics.recordFeedback({
      activityId: "activity-1",
      rating: 4,
      edited: true,
      accepted: true,
      memo: "usable"
    });
    const dashboard = createDashboardQueryService(analytics, { now: () => new Date("2026-08-02T12:00:00.000Z") });
    const view = await dashboard.getView({ period: "today" });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.metric.totalTokens).toBe(10);
    expect(view.value.metric.outcomeCount).toBe(1);
    expect(view.value.metric.averageOutcomeScore).toBe(0.8);
    expect(view.value.metric.averageRoi).toBe(1.5);
    expect(view.value.metric.feedbackCount).toBe(1);
    expect(view.value.metric.acceptedCount).toBe(1);
    expect(view.value.metric.editedCount).toBe(1);
    expect(view.value.metric.averageRating).toBe(4);
    expect(view.value.byClient["client-a"]?.usageCount).toBe(1);
    expect(view.value.byCapability["SNS.Generate"]?.acceptedCount).toBe(1);
  });

  it("builds monthly client budget metrics from manifests and usage", async () => {
    const analytics = createMemoryAnalyticsRepository();
    const clients = createClientRegistry();
    clients.register({
      id: "client-a",
      name: "Client A",
      type: "web",
      version: "0.1.0",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true,
      budget: { monthlyTokenLimit: 100, monthlyCostLimit: 10, currency: "USD" }
    });
    clients.register({
      id: "client-b",
      name: "Client B",
      type: "api",
      version: "0.1.0",
      capabilities: ["PDF.Export"],
      knowledge: [],
      analytics: true
    });
    await analytics.recordUsage({
      activityId: "activity-1",
      client: "client-a",
      capability: "SNS.Generate",
      provider: "echo",
      model: "test",
      inputTokens: 20,
      outputTokens: 30,
      totalTokens: 50,
      costAmount: 4,
      costCurrency: "USD",
      latencyMs: 100,
      occurredAt: new Date("2026-08-02T10:00:00.000Z")
    });
    await analytics.recordUsage({
      activityId: "activity-2",
      client: "client-c",
      capability: "SNS.Generate",
      provider: "echo",
      model: "test",
      inputTokens: 10,
      outputTokens: 10,
      totalTokens: 20,
      costAmount: 1,
      costCurrency: "USD",
      latencyMs: 100,
      occurredAt: new Date("2026-08-02T10:00:00.000Z")
    });
    const dashboard = createDashboardQueryService(
      analytics,
      { now: () => new Date("2026-08-02T12:00:00.000Z") },
      clients
    );

    const view = await dashboard.getClientBudgetView();

    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.clients).toHaveLength(3);
    const clientA = view.value.clients.find((client) => client.clientId === "client-a");
    const clientB = view.value.clients.find((client) => client.clientId === "client-b");
    const clientC = view.value.clients.find((client) => client.clientId === "client-c");
    expect(clientA?.usedTokens).toBe(50);
    expect(clientA?.remainingTokens).toBe(50);
    expect(clientA?.tokenUsageRatio).toBe(0.5);
    expect(clientA?.usedCost).toBe(4);
    expect(clientA?.remainingCost).toBe(6);
    expect(clientA?.costUsageRatio).toBe(0.4);
    expect(clientA?.tokenLimitReached).toBe(false);
    expect(clientA?.status).toBe("ok");
    expect(clientB?.usedTokens).toBe(0);
    expect(clientB?.monthlyTokenLimit).toBeUndefined();
    expect(clientC?.usedTokens).toBe(20);
  });

  it("marks client budget status as warning or exceeded", async () => {
    const analytics = createMemoryAnalyticsRepository();
    const clients = createClientRegistry();
    clients.register({
      id: "warning-client",
      name: "Warning Client",
      type: "web",
      version: "0.1.0",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true,
      budget: { monthlyTokenLimit: 100 }
    });
    clients.register({
      id: "exceeded-client",
      name: "Exceeded Client",
      type: "web",
      version: "0.1.0",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true,
      budget: { monthlyCostLimit: 10 }
    });
    await analytics.recordUsage({
      activityId: "activity-warning",
      client: "warning-client",
      capability: "SNS.Generate",
      provider: "echo",
      model: "test",
      inputTokens: 40,
      outputTokens: 40,
      totalTokens: 80,
      costAmount: 0,
      costCurrency: "USD",
      latencyMs: 100,
      occurredAt: new Date("2026-08-02T10:00:00.000Z")
    });
    await analytics.recordUsage({
      activityId: "activity-exceeded",
      client: "exceeded-client",
      capability: "SNS.Generate",
      provider: "echo",
      model: "test",
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      costAmount: 10,
      costCurrency: "USD",
      latencyMs: 100,
      occurredAt: new Date("2026-08-02T10:00:00.000Z")
    });
    const dashboard = createDashboardQueryService(
      analytics,
      { now: () => new Date("2026-08-02T12:00:00.000Z") },
      clients
    );

    const view = await dashboard.getClientBudgetView();

    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.clients.find((client) => client.clientId === "warning-client")?.status).toBe("warning");
    expect(view.value.clients.find((client) => client.clientId === "exceeded-client")?.status).toBe("exceeded");
  });
});
