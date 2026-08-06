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

  it("returns connection-test health and version views", async () => {
    const runtime = createPlatformRuntime({ clock: { now: () => new Date("2026-08-05T12:00:00.000Z") } });
    const handler = createPlatformHttpHandler(runtime);

    const response = await handler(new Request("https://example.com/health"));
    const legacyResponse = await handler(new Request("https://example.com/v1/health"));
    const version = await handler(new Request("https://example.com/version"));
    const method = await handler(new Request("https://example.com/health", { method: "POST" }));
    const body = await response.json() as Readonly<{
      appName: string;
      status: string;
      timestamp: string;
    }>;
    const versionBody = await version.json() as Readonly<{
      appName: string;
      appVersion: string;
      contractVersion: string;
      timestamp: string;
    }>;

    expect(response.status).toBe(200);
    expect(legacyResponse.status).toBe(200);
    expect(version.status).toBe(200);
    expect(method.status).toBe(405);
    expect(body).toEqual({
      appName: "ai-platform-core",
      status: "ok",
      timestamp: "2026-08-05T12:00:00.000Z"
    });
    expect(versionBody).toMatchObject({
      appName: "ai-platform-core",
      appVersion: "0.1.0",
      contractVersion: "0.1.0",
      timestamp: "2026-08-05T12:00:00.000Z"
    });
  });

  it("returns a connection-test contract status view", async () => {
    const runtime = createPlatformRuntime({ clock: { now: () => new Date("2026-08-05T12:30:00.000Z") } });
    const handler = createPlatformHttpHandler(runtime);

    const response = await handler(new Request("https://example.com/contracts/status"));
    const legacyResponse = await handler(new Request("https://example.com/v1/contracts/status"));
    const method = await handler(new Request("https://example.com/contracts/status", { method: "POST" }));
    const body = await response.json() as Readonly<{
      appName: string;
      status: string;
      contractVersion: string;
      identityMode: string;
      professionalIdRequired: boolean;
      usesLegacyEventNames: boolean;
      usesReportTerminology: boolean;
      canonicalOwnershipChecked: boolean;
      issues: readonly string[];
      timestamp: string;
    }>;

    expect(response.status).toBe(200);
    expect(legacyResponse.status).toBe(200);
    expect(method.status).toBe(405);
    expect(body).toEqual({
      appName: "ai-platform-core",
      status: "ok",
      contractVersion: "0.1.0",
      identityMode: "workspaceId+userId",
      professionalIdRequired: false,
      usesLegacyEventNames: false,
      usesReportTerminology: true,
      canonicalOwnershipChecked: true,
      issues: [],
      timestamp: "2026-08-05T12:30:00.000Z"
    });
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

  it("registers capability manifests through a scoped HTTP endpoint", async () => {
    const runtime = createPlatformRuntime();
    const closedHandler = createPlatformHttpHandler(runtime);
    const handler = createPlatformHttpHandler(runtime, {
      authorizeUsageRequest: (_request, clientId) => clientId === "platform_admin"
    });
    const body = {
      id: "Report.Generate",
      name: "Generate Report",
      description: "Generate a report.",
      permission: "report.generate",
      input: "json",
      output: "json"
    };

    const hidden = await closedHandler(new Request("https://example.com/v1/capabilities?client=platform_admin", {
      method: "POST",
      body: JSON.stringify(body)
    }));
    const forbidden = await handler(new Request("https://example.com/v1/capabilities?client=other_client", {
      method: "POST",
      body: JSON.stringify(body)
    }));
    const invalid = await handler(new Request("https://example.com/v1/capabilities?client=platform_admin", {
      method: "POST",
      body: JSON.stringify({ id: "Report.Generate" })
    }));
    const response = await handler(new Request("https://example.com/v1/capabilities?client=platform_admin", {
      method: "POST",
      body: JSON.stringify(body)
    }));
    const method = await handler(new Request("https://example.com/v1/capabilities?client=platform_admin"));
    const responseBody = await response.json() as Readonly<{
      ok: boolean;
      capability: Readonly<Record<string, unknown>>;
    }>;
    const registered = runtime.registry.get("Report.Generate");
    const executed = await runtime.capability.execute("Report.Generate", {}, {
      actorId: "platform_admin",
      permissions: ["report.generate"],
      metadata: {}
    });

    expect(hidden.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(400);
    expect(response.status).toBe(201);
    expect(method.status).toBe(405);
    expect(responseBody.ok).toBe(true);
    expect(responseBody.capability).toMatchObject(body);
    expect(registered.ok).toBe(true);
    expect(executed.ok).toBe(false);
    if (executed.ok) return;
    expect(executed.error.code).toBe("CAPABILITY_HTTP_MANIFEST_ONLY");
  });

  it("renders prompt templates through a scoped HTTP endpoint", async () => {
    const runtime = createPlatformRuntime();
    await runtime.prompt.register({
      id: "Report.Generate",
      version: 1,
      body: "Report for {{name}} with number {{number}}.",
      retention: "metadata"
    });
    const closedHandler = createPlatformHttpHandler(runtime);
    const handler = createPlatformHttpHandler(runtime, {
      authorizeUsageRequest: (_request, clientId) => clientId === "platform_admin"
    });
    const requestBody = {
      templateId: "Report.Generate",
      variables: { name: "A", number: 7 }
    };

    const hidden = await closedHandler(new Request("https://example.com/v1/prompt-templates/render?client=platform_admin", {
      method: "POST",
      body: JSON.stringify(requestBody)
    }));
    const forbidden = await handler(new Request("https://example.com/v1/prompt-templates/render?client=other_client", {
      method: "POST",
      body: JSON.stringify(requestBody)
    }));
    const invalid = await handler(new Request("https://example.com/v1/prompt-templates/render?client=platform_admin", {
      method: "POST",
      body: JSON.stringify({ templateId: "Report.Generate", variables: { nested: { value: true } } })
    }));
    const missing = await handler(new Request("https://example.com/v1/prompt-templates/render?client=platform_admin", {
      method: "POST",
      body: JSON.stringify({ templateId: "Report.Generate", variables: { name: "A" } })
    }));
    const response = await handler(new Request("https://example.com/v1/prompt-templates/render?client=platform_admin", {
      method: "POST",
      body: JSON.stringify(requestBody)
    }));
    const method = await handler(new Request("https://example.com/v1/prompt-templates/render?client=platform_admin"));
    const body = await response.json() as Readonly<{
      ok: boolean;
      prompt: Readonly<Record<string, unknown>>;
    }>;

    expect(hidden.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(response.status).toBe(200);
    expect(method.status).toBe(405);
    expect(body.ok).toBe(true);
    expect(body.prompt).toMatchObject({
      templateId: "Report.Generate",
      version: 1,
      rendered: "Report for A with number 7."
    });
  });
});
