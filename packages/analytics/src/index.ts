import type { ActivityFeedback, ActivityOutcome, ActivityResult } from "@ai-platform-core/activity";
import { type Result, ok } from "@ai-platform-core/kernel";

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

const increment = (
  source: Readonly<Record<string, number>>,
  key: string
): Readonly<Record<string, number>> => ({ ...source, [key]: (source[key] ?? 0) + 1 });

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
    summarize: async () => {
      const latencyTotal = usage.reduce((sum, record) => sum + record.latencyMs, 0);
      return ok({
        usageCount: usage.length,
        totalTokens: usage.reduce((sum, record) => sum + record.totalTokens, 0),
        totalCost: usage.reduce((sum, record) => sum + record.costAmount, 0),
        averageLatencyMs: usage.length === 0 ? 0 : latencyTotal / usage.length,
        byClient: usage.reduce((acc, record) => increment(acc, record.client), {}),
        byCapability: usage.reduce((acc, record) => increment(acc, record.capability), {}),
        byProvider: usage.reduce((acc, record) => increment(acc, record.provider), {}),
        byModel: usage.reduce((acc, record) => increment(acc, record.model), {})
      });
    },
    listUsage: async () => ok([...usage]),
    listOutcomes: async () => ok([...outcomes]),
    listFeedback: async () => ok([...feedback])
  };
};
