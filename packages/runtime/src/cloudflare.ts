import type { Activity, ActivityRepository } from "@ai-platform-core/activity";
import {
  createStoredAnalyticsRepository,
  type StoredActivityFeedback,
  type StoredActivityOutcome,
  type StoredUsageRecord,
} from "@ai-platform-core/analytics";
import { createClientRegistry, type ClientManifest } from "@ai-platform-core/client";
import type { DomainEvent, EventQuery, EventStore } from "@ai-platform-core/event";
import { err, ok, platformError, UUID } from "@ai-platform-core/kernel";
import { createOpenAIResponsesProvider, createProviderRegistry } from "@ai-platform-core/provider";
import { createEnvironmentSecretReader } from "@ai-platform-core/secrets";
import { createD1KeyValueStore, type D1DatabaseLike } from "@ai-platform-core/storage";
import {
  createPlatformRuntime,
  createPromptTemplateRuntime,
  createStoredPromptTemplateRepository,
  type PlatformRuntime,
  type StoredPromptTemplate,
} from "./index.js";

interface StoredActivity extends Readonly<Record<string, unknown>> {
  id: string;
  request: Activity["request"];
  status: Activity["status"];
  result?: Activity["result"];
  outcome?: Activity["outcome"];
  feedback?: Activity["feedback"];
  createdAt: string;
  updatedAt: string;
}

interface StoredDomainEvent extends Readonly<Record<string, unknown>> {
  id: string;
  type: string;
  aggregateId: string;
  version: number;
  occurredAt: string;
  payload: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
}

export interface CloudflareRuntimeEnvironment {
  readonly OPENAI_API_KEY?: string | undefined;
  readonly OPENAI_DEFAULT_MODEL?: string | undefined;
}

export interface CloudflareRuntimeOptions {
  readonly db: D1DatabaseLike;
  readonly env?: CloudflareRuntimeEnvironment;
}

const OPENAI_API_KEY_SECRET = "OPENAI_API_KEY";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

export const sanitizeActivityForStorage = (activity: Activity): StoredActivity => ({
  id: activity.id.value,
  request: {
    ...activity.request,
    goal: activity.request.capability,
    context: {},
    input: {},
  },
  status: activity.status,
  ...(activity.result === undefined
    ? {}
    : {
        result: {
          ...activity.result,
          output: {},
        },
      }),
  ...(activity.outcome === undefined ? {} : { outcome: activity.outcome }),
  ...(activity.feedback === undefined
    ? {}
    : {
        feedback: {
          activityId: activity.feedback.activityId,
          ...(activity.feedback.rating === undefined ? {} : { rating: activity.feedback.rating }),
          edited: activity.feedback.edited,
          accepted: activity.feedback.accepted,
        },
      }),
  createdAt: activity.createdAt.toISOString(),
  updatedAt: activity.updatedAt.toISOString(),
});

const fromStored = (activity: StoredActivity): Activity => ({
  id: new UUID(activity.id),
  request: activity.request,
  status: activity.status,
  ...(activity.result === undefined ? {} : { result: activity.result }),
  ...(activity.outcome === undefined ? {} : { outcome: activity.outcome }),
  ...(activity.feedback === undefined ? {} : { feedback: activity.feedback }),
  createdAt: new Date(activity.createdAt),
  updatedAt: new Date(activity.updatedAt),
});

const createStoredActivityRepository = (db: D1DatabaseLike): ActivityRepository => {
  const store = createD1KeyValueStore<StoredActivity>(db, "activities");
  return {
    save: async (activity) => {
      const saved = await store.put(activity.id.value, sanitizeActivityForStorage(activity));
      return saved.ok ? ok(activity) : err(saved.error);
    },
    get: async (id) => {
      const record = await store.get(id);
      return record.ok
        ? ok(fromStored(record.value.value))
        : err(platformError("ACTIVITY_NOT_FOUND", `Activity '${id}' was not found.`));
    },
    list: async () => {
      const records = await store.list();
      return records.ok ? ok(records.value.map((record) => fromStored(record.value))) : err(records.error);
    },
  };
};

const toStoredEvent = (event: DomainEvent): StoredDomainEvent => ({
  id: event.id.value,
  type: event.type,
  aggregateId: event.aggregateId.value,
  version: event.version,
  occurredAt: event.occurredAt.toISOString(),
  payload: event.payload,
  metadata: event.metadata,
});

const fromStoredEvent = (event: StoredDomainEvent): DomainEvent => ({
  id: new UUID(event.id),
  type: event.type,
  aggregateId: new UUID(event.aggregateId),
  version: event.version,
  occurredAt: new Date(event.occurredAt),
  payload: event.payload,
  metadata: event.metadata,
});

const matchesEventQuery = (event: DomainEvent, filter: EventQuery): boolean => {
  if (filter.aggregateId && !event.aggregateId.equals(filter.aggregateId)) return false;
  if (filter.type && event.type !== filter.type) return false;
  if (filter.types && !filter.types.includes(event.type)) return false;
  if (filter.from && event.occurredAt.getTime() < filter.from.getTime()) return false;
  if (filter.to && event.occurredAt.getTime() > filter.to.getTime()) return false;
  return true;
};

const createStoredEventStore = (db: D1DatabaseLike): EventStore => {
  const store = createD1KeyValueStore<StoredDomainEvent>(db, "events");
  return {
    append: async (events) => {
      for (const event of events) {
        const saved = await store.put(event.id.value, toStoredEvent(event));
        if (!saved.ok) return err(saved.error);
      }
      return ok(undefined);
    },
    load: async (aggregateId) => {
      const records = await store.list();
      return records.ok
        ? ok(
            records.value
              .map((record) => fromStoredEvent(record.value))
              .filter((event) => event.aggregateId.equals(aggregateId)),
          )
        : err(records.error);
    },
    query: async (filter = {}) => {
      const records = await store.list();
      return records.ok
        ? ok(records.value.map((record) => fromStoredEvent(record.value)).filter((event) => matchesEventQuery(event, filter)))
        : err(records.error);
    },
    all: async () => {
      const records = await store.list();
      return records.ok ? ok(records.value.map((record) => fromStoredEvent(record.value))) : err(records.error);
    },
  };
};

const registerClient = (clients: ReturnType<typeof createClientRegistry>, manifest: ClientManifest): void => {
  const registered = clients.register(manifest);
  if (!registered.ok) throw new Error(registered.error.message);
};

const resolveOpenAIModel = (env?: CloudflareRuntimeEnvironment): string => {
  const configured = env?.OPENAI_DEFAULT_MODEL?.trim();
  return configured === undefined || configured.length === 0 ? DEFAULT_OPENAI_MODEL : configured;
};

const createCloudflareProviderRegistry = (env?: CloudflareRuntimeEnvironment) => {
  const providers = createProviderRegistry();
  if (env?.OPENAI_API_KEY !== undefined && env.OPENAI_API_KEY.length > 0) {
    const secretReader = createEnvironmentSecretReader({ [OPENAI_API_KEY_SECRET]: env.OPENAI_API_KEY });
    providers.register(
      createOpenAIResponsesProvider({
        id: "openai",
        secretReader,
        apiKeySecretKey: OPENAI_API_KEY_SECRET,
      }),
    );
  }
  return providers;
};

export const createCloudflarePlatformRuntime = (options: CloudflareRuntimeOptions): PlatformRuntime => {
  const usage = createD1KeyValueStore<StoredUsageRecord>(options.db, "analytics.usage");
  const outcomes = createD1KeyValueStore<StoredActivityOutcome>(options.db, "analytics.outcomes");
  const feedback = createD1KeyValueStore<StoredActivityFeedback>(options.db, "analytics.feedback");
  const promptStore = createD1KeyValueStore<StoredPromptTemplate>(options.db, "prompt.templates");
  const storage = createD1KeyValueStore<Readonly<Record<string, unknown>>>(options.db, "runtime.storage");
  const events = createStoredEventStore(options.db);
  const clients = createClientRegistry();
  const providers = createCloudflareProviderRegistry(options.env);
  const openAIModel = resolveOpenAIModel(options.env);

  registerClient(clients, {
    id: "production-e2e",
    name: "Production E2E",
    type: "api",
    version: "1",
    provider: "echo",
    defaultModel: "default",
    capabilities: ["production.echo"],
    knowledge: [],
    analytics: true,
  });

  registerClient(clients, {
    id: "numeria-studio",
    name: "Numeria Studio",
    type: "api",
    version: "1",
    provider: "openai",
    defaultModel: openAIModel,
    capabilities: [
      "studio.report.generate",
      "studio.report.ai_assist",
      "numeria.report.wording_adjustment",
    ],
    knowledge: [],
    analytics: true,
  });

  registerClient(clients, {
    id: "velvet",
    name: "Velvet",
    type: "api",
    version: "1",
    provider: "openai",
    defaultModel: openAIModel,
    capabilities: [
      "velvet.ai.organize_suggest",
      "velvet.memory.summary",
      "velvet.memory.search",
      "velvet.memory.recall",
    ],
    knowledge: [],
    analytics: true,
  });

  return createPlatformRuntime({
    activityRepository: createStoredActivityRepository(options.db),
    analytics: createStoredAnalyticsRepository({ usage, outcomes, feedback }),
    clients,
    events,
    prompt: createPromptTemplateRuntime(createStoredPromptTemplateRepository(promptStore)),
    providers,
    storage,
  });
};
