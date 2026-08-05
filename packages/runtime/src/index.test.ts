import { describe, expect, it } from "vitest";
import { createOpenAICompatibleProvider } from "@ai-platform-core/provider";
import { createSecretReader } from "@ai-platform-core/secrets";
import { createStoredAnalyticsRepository } from "@ai-platform-core/analytics";
import { createMemoryKeyValueStore } from "@ai-platform-core/storage";
import {
  createMemoryPromptTemplateRepository,
  createPlatformRuntime,
  createPromptBackedCapability,
  createPromptTemplateRuntime,
  createStoredPromptTemplateRepository
} from "./index";

describe("platform runtime", () => {
  it("runs a secret-backed OpenAI-compatible provider through the gateway", async () => {
    const runtime = createPlatformRuntime();
    await runtime.secrets.set("OPENAI_API_KEY", "test-key");
    runtime.providers.register(createOpenAICompatibleProvider({
      id: "openai",
      secretReader: createSecretReader(runtime.secrets),
      apiKeySecretKey: "OPENAI_API_KEY",
      fetch: async (_url, init) => {
        expect((init?.headers as Readonly<Record<string, string>>).authorization).toBe("Bearer test-key");
        return new Response(
          JSON.stringify({
            model: "gpt-test",
            choices: [{ message: { content: "draft text" } }],
            usage: { prompt_tokens: 11, completion_tokens: 13, total_tokens: 24 }
          }),
          { status: 200 }
        );
      }
    }));
    runtime.clients.register({
      id: "fortune_teller_a",
      name: "Fortune Teller A",
      type: "web",
      version: "0.1.0",
      provider: "openai",
      defaultModel: "gpt-test",
      capabilities: ["report.generate"],
      knowledge: [],
      analytics: true
    });

    const result = await runtime.gateway.run({
      auth: { clientId: "fortune_teller_a", permissions: ["report.generate"] },
      activity: {
        client: "fortune_teller_a",
        capability: "report.generate",
        workflow: "numerology",
        goal: "Create a draft report.",
        context: {},
        input: { lifePath: 7 }
      },
      messages: [{ role: "user", content: "Draft a report." }]
    });
    const usage = await runtime.analytics.listUsage();

    expect(result.ok).toBe(true);
    expect(usage.ok).toBe(true);
    if (!usage.ok) return;
    expect(usage.value).toHaveLength(1);
    expect(usage.value[0]).toMatchObject({
      client: "fortune_teller_a",
      capability: "report.generate",
      workflow: "numerology",
      provider: "openai",
      model: "gpt-test",
      totalTokens: 24
    });
  });

  it("wires a custom analytics repository through dashboard and gateway", async () => {
    const analytics = createStoredAnalyticsRepository({
      usage: createMemoryKeyValueStore(),
      outcomes: createMemoryKeyValueStore(),
      feedback: createMemoryKeyValueStore()
    });
    const runtime = createPlatformRuntime({ analytics });
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

    const result = await runtime.gateway.run({
      auth: { clientId: "fortune_teller_a", permissions: ["report.generate"] },
      activity: {
        client: "fortune_teller_a",
        capability: "report.generate",
        workflow: "numerology",
        goal: "Create a draft report.",
        context: {},
        input: { lifePath: 7 }
      },
      messages: [{ role: "user", content: "Draft a report." }]
    });
    const usage = await analytics.listUsage();
    const dashboard = await runtime.dashboard.getView({ period: "all" });

    expect(result.ok).toBe(true);
    expect(usage.ok).toBe(true);
    if (!usage.ok) return;
    expect(usage.value).toHaveLength(1);
    expect(dashboard.ok).toBe(true);
    if (!dashboard.ok) return;
    expect(dashboard.value.metric.usageCount).toBe(1);
  });

  it("renders the latest prompt template version", async () => {
    const runtime = createPromptTemplateRuntime(createMemoryPromptTemplateRepository());

    await runtime.register({ id: "report", version: 1, body: "Old {{name}}", retention: "metadata" });
    await runtime.register({ id: "report", version: 2, body: "New {{name}} {{score}}", retention: "metadata" });
    const rendered = await runtime.render({ templateId: "report", variables: { name: "A", score: 7 } });

    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    expect(rendered.value).toEqual({ templateId: "report", version: 2, rendered: "New A 7" });
  });

  it("rejects prompt template renders with missing variables", async () => {
    const runtime = createPromptTemplateRuntime(createMemoryPromptTemplateRepository());

    await runtime.register({ id: "report", version: 1, body: "Hello {{name}}", retention: "metadata" });
    const rendered = await runtime.render({ templateId: "report", variables: {} });

    expect(rendered.ok).toBe(false);
    if (rendered.ok) return;
    expect(rendered.error.code).toBe("PROMPT_TEMPLATE_VARIABLE_MISSING");
  });

  it("renders prompt templates from a storage-backed repository", async () => {
    const store = createMemoryKeyValueStore();
    const writer = createPromptTemplateRuntime(createStoredPromptTemplateRepository(store));

    await writer.register({ id: "report", version: 1, body: "Report {{name}}", retention: "metadata" });
    const reader = createPromptTemplateRuntime(createStoredPromptTemplateRepository(store));
    const rendered = await reader.render({ templateId: "report", variables: { name: "A" } });

    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    expect(rendered.value).toEqual({ templateId: "report", version: 1, rendered: "Report A" });
  });

  it("executes a prompt-backed capability through gateway and records usage", async () => {
    const runtime = createPlatformRuntime();
    runtime.clients.register({
      id: "numeria-studio",
      name: "Numeria Studio",
      type: "web",
      version: "0.1.0",
      provider: "echo",
      defaultModel: "echo-report-v1",
      capabilities: ["Report.Generate"],
      knowledge: [],
      analytics: true
    });
    await runtime.prompt.register({
      id: "report.generate",
      version: 1,
      body: "Create report for life path {{lifePath}}.",
      retention: "metadata"
    });
    runtime.registry.register(createPromptBackedCapability(runtime, {
      id: "Report.Generate",
      name: "Generate report",
      description: "Generates a report draft from a managed prompt template.",
      permission: "Report.Generate",
      input: "Prompt template variables.",
      output: "AI activity result.",
      templateId: "report.generate",
      goal: "Generate a report draft.",
      workflow: "numeria.report"
    }));

    const result = await runtime.capability.execute("Report.Generate", { lifePath: 7 }, {
      actorId: "numeria-studio",
      permissions: ["Report.Generate"],
      metadata: {
        workspaceId: "workspace_1",
        userId: "user_1"
      }
    });
    const usage = await runtime.analytics.listUsage();

    expect(result.ok).toBe(true);
    expect(usage.ok).toBe(true);
    if (!usage.ok) return;
    expect(usage.value).toHaveLength(1);
    expect(usage.value[0]).toMatchObject({
      client: "numeria-studio",
      workspaceId: "workspace_1",
      userId: "user_1",
      capability: "Report.Generate",
      workflow: "numeria.report",
      provider: "echo",
      model: "echo-report-v1"
    });
  });
});
