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

    expect(hidden.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(400);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary.client).toBe("fortune_teller_a");
    expect(body.summary.period).toBe("month");
    expect(body.summary.usageCount).toBe(1);
    expect(body.summary.totalTokens).toBeGreaterThan(0);
    expect(body.summary.byCapability["report.generate"]?.usageCount).toBe(1);
    expect(body.summary.byWorkflow.numerology?.usageCount).toBe(1);
    expect(body.summary.byProvider.echo?.usageCount).toBe(1);
    expect(body.summary.byModel["echo-report-v1"]?.usageCount).toBe(1);
  });
});
