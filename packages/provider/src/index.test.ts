import { describe, expect, it } from "vitest";
import { createMemorySecretStore, createSecretReader } from "@ai-platform-core/secrets";
import { createEchoProvider, createOpenAICompatibleProvider, createOpenAIResponsesProvider, createProviderRegistry } from "./index";

describe("provider registry", () => {
  it("registers and resolves providers", async () => {
    const registry = createProviderRegistry();
    registry.register(createEchoProvider());
    const provider = registry.get("echo");
    expect(provider.ok).toBe(true);
    if (!provider.ok) return;
    const response = await provider.value.chat({
      model: "test",
      messages: [{ role: "user", content: "hello" }]
    });
    expect(response.ok).toBe(true);
  });

  it("creates OpenAI-compatible chat completions", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const secrets = createMemorySecretStore();
    await secrets.set("OPENAI_API_KEY", "test-key");
    const provider = createOpenAICompatibleProvider({
      secretReader: createSecretReader(secrets),
      apiKeySecretKey: "OPENAI_API_KEY",
      fetch: async (url, init) => {
        capturedUrl = String(url);
        capturedInit = init;
        return new Response(
          JSON.stringify({
            model: "gpt-test",
            choices: [{ message: { content: "hello back" } }],
            usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 }
          }),
          { status: 200 }
        );
      }
    });

    const response = await provider.chat({
      model: "gpt-test",
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(capturedUrl).toBe("https://api.openai.com/v1/chat/completions");
    expect(capturedInit?.method).toBe("POST");
    expect((capturedInit?.headers as Readonly<Record<string, string>>).authorization).toBe("Bearer test-key");
    expect(response.value.text).toBe("hello back");
    expect(response.value.tokens).toEqual({ input: 3, output: 4, total: 7 });
  });

  it("creates OpenAI responses requests", async () => {
    let capturedUrl = "";
    let capturedBody: unknown;
    const secrets = createMemorySecretStore();
    await secrets.set("OPENAI_API_KEY", "test-key");
    const provider = createOpenAIResponsesProvider({
      secretReader: createSecretReader(secrets),
      apiKeySecretKey: "OPENAI_API_KEY",
      fetch: async (url, init) => {
        capturedUrl = String(url);
        capturedBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            model: "gpt-test",
            output_text: "hello from responses",
            usage: { input_tokens: 5, output_tokens: 6, total_tokens: 11 }
          }),
          { status: 200 }
        );
      }
    });

    const response = await provider.chat({
      model: "gpt-test",
      messages: [
        { role: "system", content: "be helpful" },
        { role: "user", content: "hello" }
      ],
      metadata: { featureKey: "studio.report.generate" }
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(capturedUrl).toBe("https://api.openai.com/v1/responses");
    expect(capturedBody).toEqual({
      model: "gpt-test",
      input: [
        { role: "system", content: "be helpful" },
        { role: "user", content: "hello" }
      ],
      store: false,
      metadata: { featureKey: "studio.report.generate" }
    });
    expect(response.value.text).toBe("hello from responses");
    expect(response.value.tokens).toEqual({ input: 5, output: 6, total: 11 });
  });

  it("reads OpenAI responses text from output content when output_text is missing", async () => {
    const secrets = createMemorySecretStore();
    await secrets.set("OPENAI_API_KEY", "test-key");
    const provider = createOpenAIResponsesProvider({
      secretReader: createSecretReader(secrets),
      apiKeySecretKey: "OPENAI_API_KEY",
      fetch: async () =>
        new Response(
          JSON.stringify({
            model: "gpt-test",
            output: [{ content: [{ text: "line one" }, { text: "line two" }] }],
            usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 }
          }),
          { status: 200 }
        )
    });

    const response = await provider.chat({
      model: "gpt-test",
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.value.text).toBe("line one\nline two");
  });

  it("returns an error for OpenAI-compatible HTTP failures", async () => {
    const secrets = createMemorySecretStore();
    await secrets.set("OPENAI_API_KEY", "test-key");
    const provider = createOpenAICompatibleProvider({
      secretReader: createSecretReader(secrets),
      apiKeySecretKey: "OPENAI_API_KEY",
      fetch: async () => new Response("failed", { status: 429 })
    });

    const response = await provider.chat({
      model: "gpt-test",
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response.ok).toBe(false);
  });

  it("returns an error when OpenAI-compatible secret is missing", async () => {
    const provider = createOpenAICompatibleProvider({
      secretReader: createSecretReader(createMemorySecretStore()),
      apiKeySecretKey: "OPENAI_API_KEY",
      fetch: async () => new Response("{}")
    });

    const response = await provider.chat({
      model: "gpt-test",
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response.ok).toBe(false);
  });
});
