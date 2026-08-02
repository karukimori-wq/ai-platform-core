import { createActivityRuntime, createMemoryActivityRepository } from "@ai-platform-core/activity";
import { createMemoryAnalyticsRepository } from "@ai-platform-core/analytics";
import { createClientRegistry } from "@ai-platform-core/client";
import { createMemoryKnowledgeRepository } from "@ai-platform-core/knowledge";
import { createCryptoIdGenerator, createNoopLogger, err, platformError, systemClock } from "@ai-platform-core/kernel";
import type { AIProvider } from "@ai-platform-core/provider";
import { createEchoProvider, createProviderRegistry } from "@ai-platform-core/provider";
import { describe, expect, it } from "vitest";
import { createAIGateway, createAllowAllAuthenticator } from "./index";

describe("ai gateway", () => {
  const createInspectingProvider = (id: string): AIProvider => ({
    id,
    chat: async (request) => ({
      ok: true,
      value: {
        output: { model: request.model, provider: id },
        text: request.model,
        model: request.model,
        tokens: { input: 1, output: 1, total: 2 },
        cost: { amount: 0, currency: "USD" },
        knowledgeUsed: []
      }
    })
  });

  const createMeteredProvider = (id: string, totalTokens: number, costAmount: number): AIProvider => ({
    id,
    chat: async (request) => ({
      ok: true,
      value: {
        output: { model: request.model, provider: id },
        text: request.model,
        model: request.model,
        tokens: { input: totalTokens, output: 0, total: totalTokens },
        cost: { amount: costAmount, currency: "USD" },
        knowledgeUsed: []
      }
    })
  });

  const createFailingProvider = (id: string): AIProvider => ({
    id,
    chat: async () => err(platformError("PROVIDER_FAILED", "Provider failed."))
  });

  it("creates an activity and records usage", async () => {
    const providers = createProviderRegistry();
    providers.register(createEchoProvider());
    const analytics = createMemoryAnalyticsRepository();
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      analytics,
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger()
    );

    const result = await gateway.run({
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "SNS.Generate",
        goal: "Generate a post",
        context: {},
        provider: "echo",
        model: "test",
        input: { topic: "AI" }
      },
      messages: [{ role: "user", content: "hello" }]
    });

    expect(result.ok).toBe(true);
    const summary = await analytics.summarize();
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    expect(summary.value.usageCount).toBe(1);
  });

  it("records outcome and feedback for an owned activity", async () => {
    const providers = createProviderRegistry();
    providers.register(createEchoProvider());
    const analytics = createMemoryAnalyticsRepository();
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      analytics,
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger()
    );
    const result = await gateway.run({
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "SNS.Generate",
        goal: "Generate a post",
        context: {},
        provider: "echo",
        model: "test",
        input: { topic: "AI" }
      },
      messages: [{ role: "user", content: "hello" }]
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const outcome = await gateway.recordOutcome({
      auth: { clientId: "client-a", permissions: [] },
      outcome: {
        activityId: result.value.activityId,
        result: "published",
        score: 0.9,
        roi: 1.2
      }
    });
    const feedback = await gateway.recordFeedback({
      auth: { clientId: "client-a", permissions: [] },
      feedback: {
        activityId: result.value.activityId,
        rating: 5,
        edited: false,
        accepted: true
      }
    });

    expect(outcome.ok).toBe(true);
    expect(feedback.ok).toBe(true);
    const outcomes = await analytics.listOutcomes();
    const feedbackItems = await analytics.listFeedback();
    expect(outcomes.ok).toBe(true);
    expect(feedbackItems.ok).toBe(true);
    if (!outcomes.ok || !feedbackItems.ok) return;
    expect(outcomes.value).toHaveLength(1);
    expect(feedbackItems.value).toHaveLength(1);
  });

  it("rejects outcome recording for another client's activity", async () => {
    const providers = createProviderRegistry();
    providers.register(createEchoProvider());
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      createMemoryAnalyticsRepository(),
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger()
    );
    const result = await gateway.run({
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "SNS.Generate",
        goal: "Generate a post",
        context: {},
        provider: "echo",
        model: "test",
        input: { topic: "AI" }
      },
      messages: [{ role: "user", content: "hello" }]
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const outcome = await gateway.recordOutcome({
      auth: { clientId: "client-b", permissions: [] },
      outcome: {
        activityId: result.value.activityId,
        result: "published"
      }
    });

    expect(outcome.ok).toBe(false);
  });

  it("blocks capabilities not declared by the client manifest", async () => {
    const providers = createProviderRegistry();
    providers.register(createEchoProvider());
    const clients = createClientRegistry();
    clients.register({
      id: "client-a",
      name: "Client A",
      type: "web",
      version: "0.1.0",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true
    });
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      createMemoryAnalyticsRepository(),
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger(),
      clients
    );

    const result = await gateway.run({
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "PDF.Export",
        goal: "Export PDF",
        context: {},
        provider: "echo",
        model: "test",
        input: {}
      },
      messages: [{ role: "user", content: "hello" }]
    });

    expect(result.ok).toBe(false);
  });

  it("uses provider and model defaults from the client manifest", async () => {
    const providers = createProviderRegistry();
    providers.register(createInspectingProvider("client-default"));
    const clients = createClientRegistry();
    clients.register({
      id: "client-a",
      name: "Client A",
      type: "web",
      version: "0.1.0",
      provider: "client-default",
      defaultModel: "manifest-model",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true
    });
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      createMemoryAnalyticsRepository(),
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger(),
      clients
    );

    const result = await gateway.run({
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "SNS.Generate",
        goal: "Generate a post",
        context: {},
        input: {}
      },
      messages: [{ role: "user", content: "hello" }]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.provider).toBe("client-default");
    expect(result.value.model).toBe("manifest-model");
  });

  it("lets activity provider and model override client manifest defaults", async () => {
    const providers = createProviderRegistry();
    providers.register(createInspectingProvider("client-default"));
    providers.register(createInspectingProvider("request-provider"));
    const clients = createClientRegistry();
    clients.register({
      id: "client-a",
      name: "Client A",
      type: "web",
      version: "0.1.0",
      provider: "client-default",
      defaultModel: "manifest-model",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true
    });
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      createMemoryAnalyticsRepository(),
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger(),
      clients
    );

    const result = await gateway.run({
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "SNS.Generate",
        goal: "Generate a post",
        context: {},
        provider: "request-provider",
        model: "request-model",
        input: {}
      },
      messages: [{ role: "user", content: "hello" }]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.provider).toBe("request-provider");
    expect(result.value.model).toBe("request-model");
  });

  it("blocks usage when projected monthly token budget would be exceeded", async () => {
    const providers = createProviderRegistry();
    providers.register(createMeteredProvider("metered", 2, 0));
    const clients = createClientRegistry();
    clients.register({
      id: "client-a",
      name: "Client A",
      type: "web",
      version: "0.1.0",
      provider: "metered",
      defaultModel: "metered-model",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true,
      budget: { monthlyTokenLimit: 3 }
    });
    const analytics = createMemoryAnalyticsRepository();
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      analytics,
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger(),
      clients
    );
    const request = {
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "SNS.Generate",
        goal: "Generate a post",
        context: {},
        input: {}
      },
      messages: [{ role: "user" as const, content: "hello" }]
    };

    const first = await gateway.run(request);
    const second = await gateway.run(request);
    const summary = await analytics.summarize();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    expect(summary.value.usageCount).toBe(1);
    expect(summary.value.totalTokens).toBe(2);
  });

  it("blocks usage when projected monthly cost budget would be exceeded", async () => {
    const providers = createProviderRegistry();
    providers.register(createMeteredProvider("metered", 1, 2));
    const clients = createClientRegistry();
    clients.register({
      id: "client-a",
      name: "Client A",
      type: "web",
      version: "0.1.0",
      provider: "metered",
      defaultModel: "metered-model",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true,
      budget: { monthlyCostLimit: 3, currency: "USD" }
    });
    const analytics = createMemoryAnalyticsRepository();
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      analytics,
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger(),
      clients
    );
    const request = {
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "SNS.Generate",
        goal: "Generate a post",
        context: {},
        input: {}
      },
      messages: [{ role: "user" as const, content: "hello" }]
    };

    const first = await gateway.run(request);
    const second = await gateway.run(request);
    const summary = await analytics.summarize();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    expect(summary.value.usageCount).toBe(1);
    expect(summary.value.totalCost).toBe(2);
  });

  it("uses only knowledge allowed by the client manifest", async () => {
    const providers = createProviderRegistry();
    providers.register(createEchoProvider());
    const clients = createClientRegistry();
    clients.register({
      id: "client-a",
      name: "Client A",
      type: "web",
      version: "0.1.0",
      capabilities: ["SNS.Generate"],
      knowledge: ["knowledge-allowed"],
      analytics: true
    });
    const knowledge = createMemoryKnowledgeRepository();
    await knowledge.save({
      id: "knowledge-allowed",
      content: "AI posting guidance",
      confidence: 0.9,
      references: [],
      lifecycle: "active",
      metadata: {}
    });
    await knowledge.save({
      id: "knowledge-blocked",
      content: "AI posting guidance",
      confidence: 0.9,
      references: [],
      lifecycle: "active",
      metadata: {}
    });
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      createMemoryAnalyticsRepository(),
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger(),
      clients,
      knowledge
    );

    const result = await gateway.run({
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "SNS.Generate",
        goal: "AI posting",
        context: {},
        provider: "echo",
        model: "test",
        input: {}
      },
      messages: [{ role: "user", content: "hello" }]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.knowledgeUsed).toEqual(["knowledge-allowed"]);
  });

  it("retries a failing provider before succeeding", async () => {
    let attempts = 0;
    const flakyProvider: AIProvider = {
      id: "flaky",
      chat: async (request) => {
        attempts += 1;
        return attempts === 1
          ? err(platformError("PROVIDER_FAILED", "Provider failed."))
          : {
              ok: true,
              value: {
                output: { model: request.model },
                text: request.model,
                model: request.model,
                tokens: { input: 1, output: 1, total: 2 },
                cost: { amount: 0, currency: "USD" },
                knowledgeUsed: []
              }
            };
      }
    };
    const providers = createProviderRegistry();
    providers.register(flakyProvider);
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      createMemoryAnalyticsRepository(),
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger(),
      undefined,
      undefined,
      { retry: { maxAttempts: 2 } }
    );

    const result = await gateway.run({
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "SNS.Generate",
        goal: "Generate a post",
        context: {},
        provider: "flaky",
        model: "test",
        input: {}
      },
      messages: [{ role: "user", content: "hello" }]
    });

    expect(result.ok).toBe(true);
    expect(attempts).toBe(2);
  });

  it("falls back to the next provider when the primary provider fails", async () => {
    const providers = createProviderRegistry();
    providers.register(createFailingProvider("primary"));
    providers.register(createInspectingProvider("fallback"));
    const gateway = createAIGateway(
      createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock()),
      providers,
      createMemoryAnalyticsRepository(),
      createAllowAllAuthenticator(),
      systemClock(),
      createNoopLogger(),
      undefined,
      undefined,
      { retry: { maxAttempts: 1 }, fallbackProviders: ["fallback"] }
    );

    const result = await gateway.run({
      auth: { clientId: "client-a", permissions: [] },
      activity: {
        client: "client-a",
        capability: "SNS.Generate",
        goal: "Generate a post",
        context: {},
        provider: "primary",
        model: "test",
        input: {}
      },
      messages: [{ role: "user", content: "hello" }]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.provider).toBe("fallback");
  });
});
