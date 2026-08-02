import { describe, expect, it } from "vitest";
import { createOpenAICompatibleProvider } from "@ai-platform-core/provider";
import { createSecretReader } from "@ai-platform-core/secrets";
import { createPlatformRuntime } from "./index";

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
});
