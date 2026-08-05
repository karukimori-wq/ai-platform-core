import { createActivityRuntime, createMemoryActivityRepository, type ActivityRuntime } from "@ai-platform-core/activity";
import { createMemoryAnalyticsRepository, type AnalyticsRepository } from "@ai-platform-core/analytics";
import {
  createCapabilityRegistry,
  createCapabilityRuntime,
  createPermissionChecker,
  type CapabilityRuntime
} from "@ai-platform-core/capability";
import { createClientRegistry, type ClientRegistry } from "@ai-platform-core/client";
import { createDashboardQueryService, type DashboardQueryService } from "@ai-platform-core/dashboard";
import {
  createEventBus,
  createEventDispatcher,
  createMemoryEventStore,
  type EventBus,
  type EventDispatcher,
  type EventStore
} from "@ai-platform-core/event";
import {
  createCryptoIdGenerator,
  createNoopLogger,
  err,
  ok,
  platformError,
  systemClock,
  type Clock,
  type Logger,
  type Result
} from "@ai-platform-core/kernel";
import { createAIGateway, createAllowAllAuthenticator, type AIGateway } from "@ai-platform-core/gateway";
import { createMemoryKnowledgeRepository, type KnowledgeRepository } from "@ai-platform-core/knowledge";
import { createPluginRuntime, type PluginRuntime } from "@ai-platform-core/plugin";
import { createEchoProvider, createProviderRegistry, type ProviderRegistry } from "@ai-platform-core/provider";
import { createMemorySecretStore, type SecretStore } from "@ai-platform-core/secrets";
import { createMemoryKeyValueStore, type KeyValueStore } from "@ai-platform-core/storage";
import { createWorkflowRuntime, type WorkflowRuntime } from "@ai-platform-core/workflow";

export interface AIRuntime {
  readonly selectModel: (task: string) => Promise<string>;
}

export interface PromptTemplate {
  readonly id: string;
  readonly version: number;
  readonly body: string;
  readonly retention: "none" | "metadata" | "rendered";
}

export interface PromptTemplateRenderRequest {
  readonly templateId: string;
  readonly version?: number;
  readonly variables: Readonly<Record<string, string | number | boolean>>;
}

export interface PromptTemplateRenderResult {
  readonly templateId: string;
  readonly version: number;
  readonly rendered: string;
}

export interface PromptTemplateRepository {
  readonly save: (template: PromptTemplate) => Promise<Result<PromptTemplate>>;
  readonly get: (id: string, version?: number) => Promise<Result<PromptTemplate>>;
  readonly list: () => Promise<Result<readonly PromptTemplate[]>>;
}

export interface PromptTemplateRuntime {
  readonly register: (template: PromptTemplate) => Promise<Result<PromptTemplate>>;
  readonly render: (request: PromptTemplateRenderRequest) => Promise<Result<PromptTemplateRenderResult>>;
}

export const createMemoryPromptTemplateRepository = (): PromptTemplateRepository => {
  const templates = new Map<string, PromptTemplate>();
  const key = (id: string, version: number): string => `${id}@${String(version)}`;
  return {
    save: async (template) => {
      templates.set(key(template.id, template.version), template);
      return ok(template);
    },
    get: async (id, version) => {
      const candidates = [...templates.values()]
        .filter((template) => template.id === id && (version === undefined || template.version === version))
        .sort((a, b) => b.version - a.version);
      const template = candidates[0];
      return template === undefined
        ? err(platformError("PROMPT_TEMPLATE_NOT_FOUND", `Prompt template '${id}' was not found.`))
        : ok(template);
    },
    list: async () => ok([...templates.values()])
  };
};

export const createPromptTemplateRuntime = (
  repository: PromptTemplateRepository
): PromptTemplateRuntime => ({
  register: async (template) => repository.save(template),
  render: async (request) => {
    const template = await repository.get(request.templateId, request.version);
    if (!template.ok) return template;
    const rendered = renderTemplateBody(template.value.body, request.variables);
    return rendered.ok
      ? ok({ templateId: template.value.id, version: template.value.version, rendered: rendered.value })
      : rendered;
  }
});

const renderTemplateBody = (
  body: string,
  variables: Readonly<Record<string, string | number | boolean>>
): Result<string> => {
  const missing = new Set<string>();
  const rendered = body.replaceAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === undefined) {
      missing.add(key);
      return "";
    }
    return String(value);
  });
  return missing.size > 0
    ? err(platformError("PROMPT_TEMPLATE_VARIABLE_MISSING", `Missing template variables: ${[...missing].join(", ")}.`))
    : ok(rendered);
};

export interface PlatformRuntime {
  readonly registry: ReturnType<typeof createCapabilityRegistry>;
  readonly capability: CapabilityRuntime;
  readonly clients: ClientRegistry;
  readonly activity: ActivityRuntime;
  readonly events: EventStore;
  readonly eventBus: EventBus;
  readonly eventDispatcher: EventDispatcher;
  readonly analytics: AnalyticsRepository;
  readonly dashboard: DashboardQueryService;
  readonly gateway: AIGateway;
  readonly knowledge: KnowledgeRepository;
  readonly providers: ProviderRegistry;
  readonly workflow: WorkflowRuntime;
  readonly plugin: PluginRuntime;
  readonly prompt: PromptTemplateRuntime;
  readonly secrets: SecretStore;
  readonly storage: KeyValueStore<Readonly<Record<string, unknown>>>;
  readonly ai?: AIRuntime;
  readonly clock: Clock;
  readonly logger: Logger;
}

export interface PlatformRuntimeOptions {
  readonly analytics?: AnalyticsRepository;
  readonly clients?: ClientRegistry;
  readonly clock?: Clock;
  readonly events?: EventStore;
  readonly eventBus?: EventBus;
  readonly eventDispatcher?: EventDispatcher;
  readonly knowledge?: KnowledgeRepository;
  readonly logger?: Logger;
  readonly providers?: ProviderRegistry;
  readonly prompt?: PromptTemplateRuntime;
  readonly secrets?: SecretStore;
  readonly storage?: KeyValueStore<Readonly<Record<string, unknown>>>;
}

export const createPlatformRuntime = (options: PlatformRuntimeOptions = {}): PlatformRuntime => {
  const registry = createCapabilityRegistry();
  const clients = options.clients ?? createClientRegistry();
  const capability = createCapabilityRuntime(registry, createPermissionChecker());
  const clock = options.clock ?? systemClock();
  const logger = options.logger ?? createNoopLogger();
  const eventStore = options.events ?? createMemoryEventStore();
  const eventBus = options.eventBus ?? createEventBus();
  const eventDispatcher = options.eventDispatcher ?? createEventDispatcher(eventStore, eventBus);
  const activity = createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), clock, eventDispatcher);
  const analytics = options.analytics ?? createMemoryAnalyticsRepository();
  const knowledge = options.knowledge ?? createMemoryKnowledgeRepository();
  const providers = options.providers ?? createProviderRegistry();
  providers.register(createEchoProvider());
  return {
    registry,
    clients,
    capability,
    activity,
    events: eventStore,
    eventBus,
    eventDispatcher,
    analytics,
    dashboard: createDashboardQueryService(analytics, clock, clients),
    gateway: createAIGateway(activity, providers, analytics, createAllowAllAuthenticator(), clock, logger, clients, knowledge),
    knowledge,
    providers,
    workflow: createWorkflowRuntime(capability),
    plugin: createPluginRuntime(),
    prompt: options.prompt ?? createPromptTemplateRuntime(createMemoryPromptTemplateRepository()),
    secrets: options.secrets ?? createMemorySecretStore(),
    storage: options.storage ?? createMemoryKeyValueStore(),
    clock,
    logger
  };
};
