import { createActivityRuntime, createMemoryActivityRepository } from "@ai-platform-core/activity";
import { createMemoryAnalyticsRepository } from "@ai-platform-core/analytics";
import { createClientRegistry } from "@ai-platform-core/client";
import { createCryptoIdGenerator, createNoopLogger, systemClock } from "@ai-platform-core/kernel";
import { createEchoProvider, createProviderRegistry } from "@ai-platform-core/provider";
import { describe, expect, it } from "vitest";
import { createAIGateway, createAllowAllAuthenticator } from "./index";

describe("ai gateway", () => {
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
});
