import { describe, expect, it } from "vitest";
import { createPlatformRuntime } from "@ai-platform-core/runtime";
import { createGatewayHttpHandler, createPlatformHttpHandler } from "./index";

describe("gateway http handler", () => {
  it("runs gateway requests and records client usage", async () => {
    const runtime = createPlatformRuntime();
    runtime.clients.register({
      id: "fortune_teller_a",
      name: "Fortune Teller A",
      type: "web",
      version: "0.1.0",
      provider: "echo",
      defaultModel: "echo-report-v1",
      capabilities: ["report.generate"],
      knowledge: [],
      analytics: true
    });
    const handler = createGatewayHttpHandler(runtime);

    const response = await handler(new Request("https://example.com/v1/gateway/run", {
      method: "POST",
      body: JSON.stringify({
        auth: { clientId: "fortune_teller_a", permissions: ["report.generate"] },
        activity: {
          client: "fortune_teller_a",
          workspaceId: "workspace-numeria-a",
          userId: "user-fortune-teller-a",
          ownerUserId: "user-fortune-teller-a",
          capability: "report.generate",
          workflow: "numerology",
          goal: "Create a report.",
          context: { app: "Numeria Studio" },
          input: { lifePath: 7 }
        },
        messages: [{ role: "user", content: "Draft a report." }]
      })
    }));
    const body = await response.json() as Readonly<{ ok: boolean }>;
    const usage = await runtime.analytics.listUsage();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(usage.ok).toBe(true);
    if (!usage.ok) return;
    expect(usage.value[0]).toMatchObject({
      client: "fortune_teller_a",
      workspaceId: "workspace-numeria-a",
      userId: "user-fortune-teller-a",
      capability: "report.generate",
      workflow: "numerology",
      provider: "echo",
      model: "echo-report-v1"
    });
  });

  it("rejects invalid routes and methods", async () => {
    const handler = createGatewayHttpHandler(createPlatformRuntime());
    const missing = await handler(new Request("https://example.com/missing", { method: "POST" }));
    const method = await handler(new Request("https://example.com/v1/gateway/run", { method: "GET" }));

    expect(missing.status).toBe(404);
    expect(method.status).toBe(405);
  });

  it("returns a Platform Admin compatible health view", async () => {
    const runtime = createPlatformRuntime({ clock: { now: () => new Date("2026-08-05T12:00:00.000Z") } });
    runtime.clients.register({
      id: "fortune_teller_a",
      name: "Fortune Teller A",
      type: "web",
      version: "0.1.0",
      provider: "echo",
      defaultModel: "echo-report-v1",
      capabilities: ["report.generate"],
      knowledge: [],
      analytics: true
    });
    runtime.registry.register({
      id: "Report.Generate",
      name: "Generate Report",
      description: "Generate a report.",
      permission: "report.generate",
      input: "json",
      output: "json",
      execute: async () => ({ ok: true, value: {} })
    });
    const handler = createPlatformHttpHandler(runtime);

    const response = await handler(new Request("https://example.com/v1/health"));
    const method = await handler(new Request("https://example.com/v1/health", { method: "POST" }));
    const body = await response.json() as Readonly<{
      ok: boolean;
      health: Readonly<{
        app: string;
        status: string;
        checkedAt: string;
        contract: Readonly<{ responsibilitySource: string; requiredReferences: readonly string[] }>;
        components: Readonly<{ clients: number; capabilities: number; providers: number }>;
      }>;
    }>;

    expect(response.status).toBe(200);
    expect(method.status).toBe(405);
    expect(body.ok).toBe(true);
    expect(body.health).toMatchObject({
      app: "ai-platform-core",
      status: "ok",
      checkedAt: "2026-08-05T12:00:00.000Z",
      components: {
        clients: 1,
        capabilities: 1,
        providers: 1
      }
    });
    expect(body.health.contract.responsibilitySource).toBe("docs/contracts/app-responsibilities.md");
    expect(body.health.contract.requiredReferences).toContain("docs/contracts/identity-contract.md");
    expect(body.health.contract.requiredReferences).toContain("docs/repositories/platform-admin.md");
  });

  it("returns a Platform Admin compatible contract status view", async () => {
    const runtime = createPlatformRuntime({ clock: { now: () => new Date("2026-08-05T12:30:00.000Z") } });
    const handler = createPlatformHttpHandler(runtime);

    const response = await handler(new Request("https://example.com/v1/contracts/status"));
    const method = await handler(new Request("https://example.com/v1/contracts/status", { method: "POST" }));
    const body = await response.json() as Readonly<{
      ok: boolean;
      status: Readonly<{
        app: string;
        status: string;
        checkedAt: string;
        implementedApis: readonly string[];
        publishedEvents: readonly string[];
        pendingEventsExcluded: readonly string[];
      }>;
    }>;

    expect(response.status).toBe(200);
    expect(method.status).toBe(405);
    expect(body.ok).toBe(true);
    expect(body.status).toMatchObject({
      app: "ai-platform-core",
      status: "compatible",
      checkedAt: "2026-08-05T12:30:00.000Z"
    });
    expect(body.status.implementedApis).toContain("Activity.Create");
    expect(body.status.implementedApis).toContain("Usage.List");
    expect(body.status.publishedEvents).toContain("ai.activity.completed.v1");
    expect(body.status.pendingEventsExcluded).toContain("studio.recommendation.created.v1");
  });

  it("returns scoped usage totals", async () => {
    const runtime = createPlatformRuntime();
    runtime.clients.register({
      id: "fortune_teller_a",
      name: "Fortune Teller A",
      type: "web",
      version: "0.1.0",
      provider: "echo",
      defaultModel: "echo-report-v1",
      capabilities: ["report.generate"],
      knowledge: [],
      analytics: true
    });
    const closedHandler = createPlatformHttpHandler(runtime);
    const handler = createPlatformHttpHandler(runtime, {
      authorizeUsageRequest: (_request, clientId) => clientId === "fortune_teller_a"
    });

    await handler(new Request("https://example.com/v1/gateway/run", {
      method: "POST",
      body: JSON.stringify({
        auth: { clientId: "fortune_teller_a", permissions: ["report.generate"] },
        activity: {
          client: "fortune_teller_a",
          workspaceId: "workspace-numeria-a",
          userId: "user-fortune-teller-a",
          capability: "report.generate",
          workflow: "numerology",
          goal: "Create a report.",
          context: { app: "Numeria Studio" },
          input: { lifePath: 7 }
        },
        messages: [{ role: "user", content: "Draft a report." }]
      })
    }));

    const hidden = await closedHandler(new Request("https://example.com/v1/analytics/usage?client=fortune_teller_a"));
    const forbidden = await handler(new Request("https://example.com/v1/analytics/usage?client=other_client"));
    const invalid = await handler(new Request("https://example.com/v1/analytics/usage?client=fortune_teller_a&period=week"));
    const response = await handler(new Request("https://example.com/v1/analytics/usage?client=fortune_teller_a&period=month"));
    const scoped = await handler(new Request("https://example.com/v1/analytics/usage?client=fortune_teller_a&period=month&workspaceId=workspace-numeria-a&userId=user-fortune-teller-a"));
    const body = await response.json() as Readonly<{
      ok: boolean;
      summary: Readonly<{
        client: string;
        period: string;
        usageCount: number;
        totalTokens: number;
        byCapability: Readonly<Record<string, Readonly<{ usageCount: number; totalTokens: number }>>>;
        byWorkflow: Readonly<Record<string, Readonly<{ usageCount: number; totalTokens: number }>>>;
        byProvider: Readonly<Record<string, Readonly<{ usageCount: number; totalTokens: number }>>>;
        byModel: Readonly<Record<string, Readonly<{ usageCount: number; totalTokens: number }>>>;
      }>;
    }>;
    const scopedBody = await scoped.json() as Readonly<{
      ok: boolean;
      summary: Readonly<{ workspaceId: string; userId: string; usageCount: number }>;
    }>;

    expect(hidden.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(400);
    expect(response.status).toBe(200);
    expect(scoped.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(scopedBody.summary.workspaceId).toBe("workspace-numeria-a");
    expect(scopedBody.summary.userId).toBe("user-fortune-teller-a");
    expect(scopedBody.summary.usageCount).toBe(1);
    expect(body.summary.client).toBe("fortune_teller_a");
    expect(body.summary.period).toBe("month");
    expect(body.summary.usageCount).toBe(1);
    expect(body.summary.totalTokens).toBeGreaterThan(0);
    expect(body.summary.byCapability["report.generate"]?.usageCount).toBe(1);
    expect(body.summary.byWorkflow.numerology?.usageCount).toBe(1);
    expect(body.summary.byProvider.echo?.usageCount).toBe(1);
    expect(body.summary.byModel["echo-report-v1"]?.usageCount).toBe(1);
  });

  it("returns scoped dashboard usage views", async () => {
    const runtime = createPlatformRuntime();
    runtime.clients.register({
      id: "fortune_teller_a",
      name: "Fortune Teller A",
      type: "web",
      version: "0.1.0",
      provider: "echo",
      defaultModel: "echo-report-v1",
      capabilities: ["report.generate"],
      knowledge: [],
      analytics: true
    });
    const handler = createPlatformHttpHandler(runtime, {
      authorizeUsageRequest: (_request, clientId) => clientId === "fortune_teller_a"
    });

    await handler(new Request("https://example.com/v1/gateway/run", {
      method: "POST",
      body: JSON.stringify({
        auth: { clientId: "fortune_teller_a", permissions: ["report.generate"] },
        activity: {
          client: "fortune_teller_a",
          workspaceId: "workspace-numeria-a",
          userId: "user-fortune-teller-a",
          capability: "report.generate",
          goal: "Create a report.",
          context: { app: "Numeria Studio" },
          input: { lifePath: 7 }
        },
        messages: [{ role: "user", content: "Draft a report." }]
      })
    }));

    const hidden = await createPlatformHttpHandler(runtime)(
      new Request("https://example.com/v1/dashboard/usage?client=fortune_teller_a")
    );
    const forbidden = await handler(new Request("https://example.com/v1/dashboard/usage?client=other_client"));
    const invalid = await handler(new Request("https://example.com/v1/dashboard/usage?client=fortune_teller_a&period=week"));
    const response = await handler(new Request("https://example.com/v1/dashboard/usage?client=fortune_teller_a&period=month&workspaceId=workspace-numeria-a&userId=user-fortune-teller-a"));
    const body = await response.json() as Readonly<{
      ok: boolean;
      view: Readonly<{
        period: string;
        metric: Readonly<{ usageCount: number; totalTokens: number }>;
        byClient: Readonly<Record<string, Readonly<{ usageCount: number }>>>;
        byWorkspace: Readonly<Record<string, Readonly<{ usageCount: number }>>>;
        byUser: Readonly<Record<string, Readonly<{ usageCount: number }>>>;
      }>;
    }>;

    expect(hidden.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(400);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.view.period).toBe("month");
    expect(body.view.metric.usageCount).toBe(1);
    expect(body.view.metric.totalTokens).toBeGreaterThan(0);
    expect(body.view.byClient.fortune_teller_a?.usageCount).toBe(1);
    expect(body.view.byWorkspace["workspace-numeria-a"]?.usageCount).toBe(1);
    expect(body.view.byUser["user-fortune-teller-a"]?.usageCount).toBe(1);
  });

  it("returns scoped activity status without raw input or context", async () => {
    const runtime = createPlatformRuntime();
    runtime.clients.register({
      id: "fortune_teller_a",
      name: "Fortune Teller A",
      type: "web",
      version: "0.1.0",
      provider: "echo",
      defaultModel: "echo-report-v1",
      capabilities: ["report.generate"],
      knowledge: [],
      analytics: true
    });
    const handler = createPlatformHttpHandler(runtime, {
      authorizeUsageRequest: (_request, clientId) => clientId === "fortune_teller_a"
    });

    const runResponse = await handler(new Request("https://example.com/v1/gateway/run", {
      method: "POST",
      body: JSON.stringify({
        auth: { clientId: "fortune_teller_a", permissions: ["report.generate"] },
        activity: {
          client: "fortune_teller_a",
          workspaceId: "workspace-numeria-a",
          userId: "user-fortune-teller-a",
          capability: "report.generate",
          workflow: "numerology",
          goal: "Create a report.",
          context: { consultation: "private context" },
          input: { privateValue: "do not expose" }
        },
        messages: [{ role: "user", content: "Draft a report." }]
      })
    }));
    const runBody = await runResponse.json() as Readonly<{
      result: Readonly<{ activityId: string }>;
    }>;

    const hidden = await createPlatformHttpHandler(runtime)(
      new Request(`https://example.com/v1/activities/${runBody.result.activityId}?client=fortune_teller_a`)
    );
    const forbidden = await handler(
      new Request(`https://example.com/v1/activities/${runBody.result.activityId}?client=other_client`)
    );
    const scopedMiss = await handler(
      new Request(`https://example.com/v1/activities/${runBody.result.activityId}?client=fortune_teller_a&workspaceId=other_workspace`)
    );
    const response = await handler(
      new Request(`https://example.com/v1/activities/${runBody.result.activityId}?client=fortune_teller_a&workspaceId=workspace-numeria-a&userId=user-fortune-teller-a`)
    );
    const method = await handler(
      new Request(`https://example.com/v1/activities/${runBody.result.activityId}?client=fortune_teller_a`, { method: "POST" })
    );
    const body = await response.json() as Readonly<{
      ok: boolean;
      activity: Readonly<Record<string, unknown>>;
    }>;

    expect(hidden.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(scopedMiss.status).toBe(404);
    expect(response.status).toBe(200);
    expect(method.status).toBe(405);
    expect(body.ok).toBe(true);
    expect(body.activity).toMatchObject({
      id: runBody.result.activityId,
      client: "fortune_teller_a",
      workspaceId: "workspace-numeria-a",
      userId: "user-fortune-teller-a",
      capability: "report.generate",
      workflow: "numerology",
      status: "completed",
      provider: "echo",
      model: "echo-report-v1"
    });
    expect(body.activity.input).toBeUndefined();
    expect(body.activity.context).toBeUndefined();
  });
});
