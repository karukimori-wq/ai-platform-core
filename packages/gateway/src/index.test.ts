import { createActivityRuntime, createMemoryActivityRepository } from "@ai-platform-core/activity";
import { createMemoryAnalyticsRepository } from "@ai-platform-core/analytics";
import { createClientRegistry } from "@ai-platform-core/client";
import { createMemoryKnowledgeRepository } from "@ai-platform-core/knowledge";
import { createCryptoIdGenerator, createNoopLogger, systemClock } from "@ai-platform-core/kernel";
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
});
