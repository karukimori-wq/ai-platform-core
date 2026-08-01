import { createActivityRuntime, createMemoryActivityRepository, type ActivityRuntime } from "@ai-platform-core/activity";
import { createMemoryAnalyticsRepository, type AnalyticsRepository } from "@ai-platform-core/analytics";
import {
  createCapabilityRegistry,
  createCapabilityRuntime,
  createPermissionChecker,
  type CapabilityRuntime
} from "@ai-platform-core/capability";
import { createClientRegistry, type ClientRegistry } from "@ai-platform-core/client";
import {
  createEventBus,
  createEventDispatcher,
  createMemoryEventStore,
  type EventBus,
  type EventDispatcher,
  type EventStore
} from "@ai-platform-core/event";
import { createCryptoIdGenerator, createNoopLogger, systemClock, type Clock, type Logger } from "@ai-platform-core/kernel";
import { createAIGateway, createAllowAllAuthenticator, type AIGateway } from "@ai-platform-core/gateway";
import { createPluginRuntime, type PluginRuntime } from "@ai-platform-core/plugin";
import { createEchoProvider, createProviderRegistry, type ProviderRegistry } from "@ai-platform-core/provider";
import { createMemoryKeyValueStore, type KeyValueStore } from "@ai-platform-core/storage";
import { createWorkflowRuntime, type WorkflowRuntime } from "@ai-platform-core/workflow";

export interface AIRuntime {
  readonly selectModel: (task: string) => Promise<string>;
}

export interface PlatformRuntime {
  readonly registry: ReturnType<typeof createCapabilityRegistry>;
  readonly capability: CapabilityRuntime;
  readonly clients: ClientRegistry;
  readonly activity: ActivityRuntime;
  readonly events: EventStore;
  readonly eventBus: EventBus;
  readonly eventDispatcher: EventDispatcher;
  readonly analytics: AnalyticsRepository;
  readonly gateway: AIGateway;
  readonly providers: ProviderRegistry;
  readonly workflow: WorkflowRuntime;
  readonly plugin: PluginRuntime;
  readonly storage: KeyValueStore<Readonly<Record<string, unknown>>>;
  readonly ai?: AIRuntime;
  readonly clock: Clock;
  readonly logger: Logger;
}

export const createPlatformRuntime = (): PlatformRuntime => {
  const registry = createCapabilityRegistry();
  const clients = createClientRegistry();
  const capability = createCapabilityRuntime(registry, createPermissionChecker());
  const clock = systemClock();
  const logger = createNoopLogger();
  const eventStore = createMemoryEventStore();
  const eventBus = createEventBus();
  const eventDispatcher = createEventDispatcher(eventStore, eventBus);
  const activity = createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), clock, eventDispatcher);
  const analytics = createMemoryAnalyticsRepository();
  const providers = createProviderRegistry();
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
    gateway: createAIGateway(activity, providers, analytics, createAllowAllAuthenticator(), clock, logger, clients),
    providers,
    workflow: createWorkflowRuntime(capability),
    plugin: createPluginRuntime(),
    storage: createMemoryKeyValueStore(),
    clock,
    logger
  };
};
