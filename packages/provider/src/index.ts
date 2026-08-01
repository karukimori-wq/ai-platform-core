import type { CostUsage, TokenUsage } from "@ai-platform-core/activity";
import { type Result, err, ok, platformError } from "@ai-platform-core/kernel";

export interface AIMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
}

export interface AIProviderRequest {
  readonly model: string;
  readonly messages: readonly AIMessage[];
  readonly input?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AIProviderResponse {
  readonly output: Readonly<Record<string, unknown>>;
  readonly text?: string;
  readonly model: string;
  readonly tokens: TokenUsage;
  readonly cost: CostUsage;
  readonly knowledgeUsed: readonly string[];
}

export interface AIProvider {
  readonly id: string;
  readonly chat: (request: AIProviderRequest) => Promise<Result<AIProviderResponse>>;
  readonly image?: (request: AIProviderRequest) => Promise<Result<AIProviderResponse>>;
  readonly embedding?: (request: AIProviderRequest) => Promise<Result<AIProviderResponse>>;
  readonly speech?: (request: AIProviderRequest) => Promise<Result<AIProviderResponse>>;
  readonly tts?: (request: AIProviderRequest) => Promise<Result<AIProviderResponse>>;
  readonly moderation?: (request: AIProviderRequest) => Promise<Result<AIProviderResponse>>;
}

export interface ProviderRegistry {
  readonly register: (provider: AIProvider) => Result<void>;
  readonly get: (id: string) => Result<AIProvider>;
  readonly list: () => readonly AIProvider[];
}

export const createProviderRegistry = (): ProviderRegistry => {
  const providers = new Map<string, AIProvider>();
  return {
    register: (provider) => {
      providers.set(provider.id, provider);
      return ok(undefined);
    },
    get: (id) => {
      const provider = providers.get(id);
      return provider === undefined
        ? err(platformError("PROVIDER_NOT_FOUND", `Provider '${id}' was not registered.`))
        : ok(provider);
    },
    list: () => [...providers.values()]
  };
};

export const createEchoProvider = (id = "echo"): AIProvider => ({
  id,
  chat: async (request) => {
    const text = request.messages.map((message) => message.content).join("\n");
    return ok({
      output: { text, input: request.input ?? {} },
      text,
      model: request.model,
      tokens: { input: text.length, output: text.length, total: text.length * 2 },
      cost: { amount: 0, currency: "USD" },
      knowledgeUsed: []
    });
  }
});
