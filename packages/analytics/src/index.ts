import type { ActivityFeedback, ActivityOutcome, ActivityResult } from "@ai-platform-core/activity";
import { type Result, ok } from "@ai-platform-core/kernel";
import type { KeyValueStore } from "@ai-platform-core/storage";

export interface UsageRecord {
  readonly activityId: string;
  readonly client: string;
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

interface StoredUsageRecord extends Readonly<Record<string, unknown>> {
  readonly activityId: string;
  readonly client: string;
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

interface StoredActivityOutcome extends Readonly<Record<string, unknown>> {
  readonly activityId: string;
  readonly result: string;
  readonly score?: number;
  readonly roi?: number;
}

interface StoredActivityFeedback extends Readonly<Record<string, unknown>> {
  readonly activityId: string;
  readonly rating?: number;
  readonly edited: boolean;
  readonly accepted: boolean;
  readonly memo?: string;
}

const increment = (
  source: Readonly<Record<string, number>>,
  key: string
): Readonly<Record<string, number>> => ({ ...source, [key]: (source[key] ?? 0) + 1 });

const summarizeUsage = (usage: readonly UsageRecord[]): AnalyticsSummary => {
  const latencyTotal = usage.reduce((sum, record) => sum + record.latencyMs, 0);
  return {
    usageCount: usage.length,
    totalTokens: usage.reduce((sum, record) => sum + record.totalTokens, 0),
    totalCost: usage.reduce((sum, record) => sum + record.costAmount, 0),
    averageLatencyMs: usage.length === 0 ? 0 : latencyTotal / usage.length,
    byClient: usage.reduce((acc, record) => increment(acc, record.client), {}),
    byCapability: usage.reduce((acc, record) => increment(acc, record.capability), {}),
    byProvider: usage.reduce((acc, record) => increment(acc, record.provider), {}),
    byModel: usage.reduce((acc, record) => increment(acc, record.model), {})
  };
};

export const createUsageRecord = (
  activity: {
    readonly id: { readonly value: string };
    readonly request: { readonly client: string; readonly capability: string; readonly workflow?: string };
  },
  result: ActivityResult,
  occurredAt: Date
): UsageRecord => {
  const base = {
    activityId: activity.id.value,
    client: activity.request.client,
    capability: activity.request.capability,
    provider: result.provider,
    model: result.model,
    inputTokens: result.tokens.input,
    outputTokens: result.tokens.output,
    totalTokens: result.tokens.total,
    costAmount: result.cost.amount,
    costCurrency: result.cost.currency,
    latencyMs: result.latencyMs,
    occurredAt
  };
  return activity.request.workflow === undefined ? base : { ...base, workflow: activity.request.workflow };
};

export const createMemoryAnalyticsRepository = (): AnalyticsRepository => {
  const usage: UsageRecord[] = [];
  const outcomes: ActivityOutcome[] = [];
  const feedback: ActivityFeedback[] = [];
  return {
    recordUsage: async (record) => {
      usage.push(record);
      return ok(undefined);
    },
    recordOutcome: async (outcome) => {
      outcomes.push(outcome);
      return ok(undefined);
    },
    recordFeedback: async (item) => {
      feedback.push(item);
      return ok(undefined);
    },
    summarize: async () => ok(summarizeUsage(usage)),
    listUsage: async () => ok([...usage]),
    listOutcomes: async () => ok([...outcomes]),
    listFeedback: async () => ok([...feedback])
  };
};

const toStoredUsageRecord = (usage: UsageRecord): StoredUsageRecord => {
  const base = {
    activityId: usage.activityId,
    client: usage.client,
    capability: usage.capability,
    provider: usage.provider,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    costAmount: usage.costAmount,
    costCurrency: usage.costCurrency,
    latencyMs: usage.latencyMs,
    occurredAt: usage.occurredAt.toISOString()
  };
  return usage.workflow === undefined ? base : { ...base, workflow: usage.workflow };
};

const fromStoredUsageRecord = (usage: StoredUsageRecord): UsageRecord => {
  const base = {
    activityId: usage.activityId,
    client: usage.client,
    capability: usage.capability,
    provider: usage.provider,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    costAmount: usage.costAmount,
    costCurrency: usage.costCurrency,
    latencyMs: usage.latencyMs,
    occurredAt: new Date(usage.occurredAt)
  };
  return usage.workflow === undefined ? base : { ...base, workflow: usage.workflow };
};

const toStoredActivityOutcome = (outcome: ActivityOutcome): StoredActivityOutcome => {
  const base = {
    activityId: outcome.activityId,
    result: outcome.result
  };
  const withScore = outcome.score === undefined ? base : { ...base, score: outcome.score };
  return outcome.roi === undefined ? withScore : { ...withScore, roi: outcome.roi };
};

const toStoredActivityFeedback = (feedback: ActivityFeedback): StoredActivityFeedback => {
  const base = {
    activityId: feedback.activityId,
    edited: feedback.edited,
    accepted: feedback.accepted
  };
  const withRating = feedback.rating === undefined ? base : { ...base, rating: feedback.rating };
  return feedback.memo === undefined ? withRating : { ...withRating, memo: feedback.memo };
};

export const createStoredAnalyticsRepository = (
  stores: {
    readonly usage: KeyValueStore<StoredUsageRecord>;
    readonly outcomes: KeyValueStore<StoredActivityOutcome>;
    readonly feedback: KeyValueStore<StoredActivityFeedback>;
  }
): AnalyticsRepository => ({
  recordUsage: async (record) => {
    const saved = await stores.usage.put(record.activityId, toStoredUsageRecord(record));
    return saved.ok ? ok(undefined) : saved;
  },
  recordOutcome: async (outcome) => {
    const saved = await stores.outcomes.put(outcome.activityId, toStoredActivityOutcome(outcome));
    return saved.ok ? ok(undefined) : saved;
  },
  recordFeedback: async (feedback) => {
    const saved = await stores.feedback.put(feedback.activityId, toStoredActivityFeedback(feedback));
    return saved.ok ? ok(undefined) : saved;
  },
  summarize: async () => {
    const usage = await stores.usage.list();
    return usage.ok ? ok(summarizeUsage(usage.value.map((record) => fromStoredUsageRecord(record.value)))) : usage;
  },
  listUsage: async () => {
    const usage = await stores.usage.list();
    return usage.ok ? ok(usage.value.map((record) => fromStoredUsageRecord(record.value))) : usage;
  },
  listOutcomes: async () => {
    const outcomes = await stores.outcomes.list();
    return outcomes.ok ? ok(outcomes.value.map((record) => record.value)) : outcomes;
  },
  listFeedback: async () => {
    const feedback = await stores.feedback.list();
    return feedback.ok ? ok(feedback.value.map((record) => record.value)) : feedback;
  }
});
