import type { ActivityFeedback, ActivityOutcome, ActivityResult } from "@ai-platform-core/activity";
import { type Result, ok } from "@ai-platform-core/kernel";
import type { KeyValueStore } from "@ai-platform-core/storage";

export interface UsageRecord {
  readonly activityId: string;
  readonly client: string;
  readonly workspaceId?: string;
  readonly userId?: string;
  readonly ownerUserId?: string;
  readonly capability: string;
  readonly workflow?: string;
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly costAmount: number;
  readonly costCurrency: string;
  readonly latencyMs: number;
  readonly occurredAt: Date;
}

export interface AnalyticsSummary {
  readonly usageCount: number;
  readonly totalTokens: number;
  readonly totalCost: number;
  readonly averageLatencyMs: number;
  readonly byClient: Readonly<Record<string, number>>;
  readonly byWorkspace: Readonly<Record<string, number>>;
  readonly byUser: Readonly<Record<string, number>>;
  readonly byCapability: Readonly<Record<string, number>>;
  readonly byProvider: Readonly<Record<string, number>>;
  readonly byModel: Readonly<Record<string, number>>;
}

export interface AnalyticsRepository {
  readonly recordUsage: (usage: UsageRecord) => Promise<Result<void>>;
  readonly recordOutcome: (outcome: ActivityOutcome) => Promise<Result<void>>;
  readonly recordFeedback: (feedback: ActivityFeedback) => Promise<Result<void>>;
  readonly summarize: () => Promise<Result<AnalyticsSummary>>;
  readonly listUsage: () => Promise<Result<readonly UsageRecord[]>>;
  readonly listOutcomes: () => Promise<Result<readonly ActivityOutcome[]>>;
  readonly listFeedback: () => Promise<Result<readonly ActivityFeedback[]>>;
}

export interface StoredUsageRecord extends Readonly<Record<string, unknown>> {
  readonly activityId: string;
  readonly client: string;
  readonly workspaceId?: string;
  readonly userId?: string;
  readonly ownerUserId?: string;
  readonly capability: string;
  readonly workflow?: string;
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly costAmount: number;
  readonly costCurrency: string;
  readonly latencyMs: number;
  readonly occurredAt: string;
}

export interface StoredActivityOutcome extends Readonly<Record<string, unknown>> {
  readonly activityId: string;
  readonly result: string;
  readonly score?: number;
  readonly roi?: number;
}

export interface StoredActivityFeedback extends Readonly<Record<string, unknown>> {
  readonly activityId: string;
  readonly rating?: number;
  readonly edited: boolean;
  readonly accepted: boolean;
}

const toStoredUsage = (usage: UsageRecord): StoredUsageRecord => ({
  ...usage,
  occurredAt: usage.occurredAt.toISOString(),
});

const fromStoredUsage = (usage: StoredUsageRecord): UsageRecord => ({
  ...usage,
  occurredAt: new Date(usage.occurredAt),
});

const toStoredOutcome = (outcome: ActivityOutcome): StoredActivityOutcome => ({ ...outcome });
const fromStoredOutcome = (outcome: StoredActivityOutcome): ActivityOutcome => ({ ...outcome });

export const toStoredFeedback = (feedback: ActivityFeedback): StoredActivityFeedback => ({
  activityId: feedback.activityId,
  ...(feedback.rating === undefined ? {} : { rating: feedback.rating }),
  edited: feedback.edited,
  accepted: feedback.accepted,
});

const fromStoredFeedback = (feedback: StoredActivityFeedback): ActivityFeedback => ({ ...feedback });

const summarizeUsage = (usage: readonly UsageRecord[]): AnalyticsSummary => {
  const group = (selector: (item: UsageRecord) => string | undefined) =>
    usage.reduce<Record<string, number>>((acc, item) => {
      const key = selector(item);
      if (key !== undefined) acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  const totalTokens = usage.reduce((sum, item) => sum + item.totalTokens, 0);
  const totalCost = usage.reduce((sum, item) => sum + item.costAmount, 0);
  const totalLatency = usage.reduce((sum, item) => sum + item.latencyMs, 0);
  return {
    usageCount: usage.length,
    totalTokens,
    totalCost,
    averageLatencyMs: usage.length === 0 ? 0 : totalLatency / usage.length,
    byClient: group((item) => item.client),
    byWorkspace: group((item) => item.workspaceId),
    byUser: group((item) => item.userId),
    byCapability: group((item) => item.capability),
    byProvider: group((item) => item.provider),
    byModel: group((item) => item.model),
  };
};

export const createMemoryAnalyticsRepository = (): AnalyticsRepository => {
  const usage: UsageRecord[] = [];
  const outcomes: ActivityOutcome[] = [];
  const feedback: ActivityFeedback[] = [];
  return {
    recordUsage: async (item) => {
      usage.push(item);
      return ok(undefined);
    },
    recordOutcome: async (item) => {
      outcomes.push(item);
      return ok(undefined);
    },
    recordFeedback: async (item) => {
      feedback.push(item);
      return ok(undefined);
    },
    summarize: async () => ok(summarizeUsage(usage)),
    listUsage: async () => ok(usage),
    listOutcomes: async () => ok(outcomes),
    listFeedback: async () => ok(feedback),
  };
};

export const createStoredAnalyticsRepository = (stores: {
  readonly usage: KeyValueStore<StoredUsageRecord>;
  readonly outcomes: KeyValueStore<StoredActivityOutcome>;
  readonly feedback: KeyValueStore<StoredActivityFeedback>;
}): AnalyticsRepository => ({
  recordUsage: async (usage) => {
    const result = await stores.usage.put(usage.activityId, toStoredUsage(usage));
    return result.ok ? ok(undefined) : result;
  },
  recordOutcome: async (outcome) => {
    const result = await stores.outcomes.put(outcome.activityId, toStoredOutcome(outcome));
    return result.ok ? ok(undefined) : result;
  },
  recordFeedback: async (feedback) => {
    const result = await stores.feedback.put(feedback.activityId, toStoredFeedback(feedback));
    return result.ok ? ok(undefined) : result;
  },
  summarize: async () => {
    const records = await stores.usage.list();
    return records.ok ? ok(summarizeUsage(records.value.map((record) => fromStoredUsage(record.value)))) : records;
  },
  listUsage: async () => {
    const records = await stores.usage.list();
    return records.ok ? ok(records.value.map((record) => fromStoredUsage(record.value))) : records;
  },
  listOutcomes: async () => {
    const records = await stores.outcomes.list();
    return records.ok ? ok(records.value.map((record) => fromStoredOutcome(record.value))) : records;
  },
  listFeedback: async () => {
    const records = await stores.feedback.list();
    return records.ok ? ok(records.value.map((record) => fromStoredFeedback(record.value))) : records;
  },
});

export const usageFromActivity = (activity: {
  readonly id: { readonly value: string };
  readonly request: {
    readonly client: string;
    readonly workspaceId?: string;
    readonly userId?: string;
    readonly ownerUserId?: string;
    readonly capability: string;
    readonly workflow?: string;
  };
  readonly result?: ActivityResult;
  readonly updatedAt: Date;
}): UsageRecord | undefined =>
  activity.result === undefined
    ? undefined
    : {
        activityId: activity.id.value,
        client: activity.request.client,
        ...(activity.request.workspaceId === undefined ? {} : { workspaceId: activity.request.workspaceId }),
        ...(activity.request.userId === undefined ? {} : { userId: activity.request.userId }),
        ...(activity.request.ownerUserId === undefined ? {} : { ownerUserId: activity.request.ownerUserId }),
        capability: activity.request.capability,
        ...(activity.request.workflow === undefined ? {} : { workflow: activity.request.workflow }),
        provider: activity.result.provider,
        model: activity.result.model,
        inputTokens: activity.result.tokens.input,
        outputTokens: activity.result.tokens.output,
        totalTokens: activity.result.tokens.total,
        costAmount: activity.result.cost.amount,
        costCurrency: activity.result.cost.currency,
        latencyMs: activity.result.latencyMs,
        occurredAt: activity.updatedAt,
      };
