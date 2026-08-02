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

export interface OpenAICompatibleProviderConfig {
  readonly id?: string;
  readonly baseUrl?: string;
  readonly apiKey: string;
  readonly organization?: string;
  readonly defaultHeaders?: Readonly<Record<string, string>>;
  readonly fetch?: typeof fetch;
}

interface OpenAIChatCompletionChoice {
  readonly message?: {
    readonly content?: unknown;
  };
}

interface OpenAIChatCompletionUsage {
  readonly prompt_tokens?: unknown;
  readonly completion_tokens?: unknown;
  readonly total_tokens?: unknown;
}

interface OpenAIChatCompletionResponse {
  readonly model?: unknown;
  readonly choices?: unknown;
  readonly usage?: unknown;
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

const parseNumber = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const parseChoices = (value: unknown): readonly OpenAIChatCompletionChoice[] =>
  Array.isArray(value) ? value.filter((item): item is OpenAIChatCompletionChoice => typeof item === "object" && item !== null) : [];

const parseUsage = (value: unknown): OpenAIChatCompletionUsage =>
  typeof value === "object" && value !== null ? value : {};

const parseChatCompletion = (value: unknown): Result<OpenAIChatCompletionResponse> =>
  typeof value === "object" && value !== null
    ? ok(value)
    : err(platformError("PROVIDER_INVALID_RESPONSE", "Provider response was not a JSON object."));

const readResponseText = (response: OpenAIChatCompletionResponse): string => {
  const firstChoice = parseChoices(response.choices)[0];
  const content = firstChoice?.message?.content;
  return typeof content === "string" ? content : "";
};

export const createOpenAICompatibleProvider = (config: OpenAICompatibleProviderConfig): AIProvider => {
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  const fetchImpl = config.fetch ?? fetch;
  return {
    id: config.id ?? "openai",
    chat: async (request) => {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
          ...config.defaultHeaders,
          ...(config.organization === undefined ? {} : { "openai-organization": config.organization })
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages
        })
      });
      if (!response.ok) {
        return err(platformError("PROVIDER_HTTP_ERROR", `Provider returned HTTP ${String(response.status)}.`));
      }
      const parsed = parseChatCompletion(await response.json());
      if (!parsed.ok) return parsed;
      const usage = parseUsage(parsed.value.usage);
      const text = readResponseText(parsed.value);
      const tokens: TokenUsage = {
        input: parseNumber(usage.prompt_tokens),
        output: parseNumber(usage.completion_tokens),
        total: parseNumber(usage.total_tokens)
      };
      return ok({
        output: { text },
        text,
        model: typeof parsed.value.model === "string" ? parsed.value.model : request.model,
        tokens,
        cost: { amount: 0, currency: "USD" },
        knowledgeUsed: []
      });
    }
  };
};
