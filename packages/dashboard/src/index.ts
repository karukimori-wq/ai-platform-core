import type { AnalyticsRepository, UsageRecord } from "@ai-platform-core/analytics";
import { type Clock, type Result, ok } from "@ai-platform-core/kernel";

export type DashboardPeriod = "today" | "month" | "year" | "all";

export interface DashboardQuery {
  readonly period: DashboardPeriod;
  readonly now?: Date;
}

export interface DashboardMetric {
  readonly usageCount: number;
  readonly totalTokens: number;
  readonly totalCost: number;
  readonly averageLatencyMs: number;
}

export interface DashboardView {
  readonly period: DashboardPeriod;
  readonly metric: DashboardMetric;
  readonly byClient: Readonly<Record<string, DashboardMetric>>;
  readonly byCapability: Readonly<Record<string, DashboardMetric>>;
  readonly byProvider: Readonly<Record<string, DashboardMetric>>;
  readonly byModel: Readonly<Record<string, DashboardMetric>>;
}

export interface DashboardQueryService {
  readonly getView: (query: DashboardQuery) => Promise<Result<DashboardView>>;
}

const emptyMetric = (): DashboardMetric => ({
  usageCount: 0,
  totalTokens: 0,
  totalCost: 0,
  averageLatencyMs: 0
});

const addRecord = (metric: DashboardMetric, record: UsageRecord): DashboardMetric => {
  const usageCount = metric.usageCount + 1;
  const latencyTotal = metric.averageLatencyMs * metric.usageCount + record.latencyMs;
  return {
    usageCount,
    totalTokens: metric.totalTokens + record.totalTokens,
    totalCost: metric.totalCost + record.costAmount,
    averageLatencyMs: latencyTotal / usageCount
  };
};

const groupBy = (
  records: readonly UsageRecord[],
  keyOf: (record: UsageRecord) => string
): Readonly<Record<string, DashboardMetric>> =>
  records.reduce<Readonly<Record<string, DashboardMetric>>>((acc, record) => {
    const key = keyOf(record);
    return { ...acc, [key]: addRecord(acc[key] ?? emptyMetric(), record) };
  }, {});

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfYear = (date: Date): Date => new Date(date.getFullYear(), 0, 1);

const filterByPeriod = (
  records: readonly UsageRecord[],
  period: DashboardPeriod,
  now: Date
): readonly UsageRecord[] => {
  if (period === "all") return records;
  const start = period === "today" ? startOfDay(now) : period === "month" ? startOfMonth(now) : startOfYear(now);
  return records.filter((record) => record.occurredAt.getTime() >= start.getTime() && record.occurredAt.getTime() <= now.getTime());
};

export const createDashboardQueryService = (
  analytics: AnalyticsRepository,
  clock: Clock
): DashboardQueryService => ({
  getView: async (query) => {
    const usage = await analytics.listUsage();
    if (!usage.ok) return usage;
    const now = query.now ?? clock.now();
    const records = filterByPeriod(usage.value, query.period, now);
    return ok({
      period: query.period,
      metric: records.reduce((metric, record) => addRecord(metric, record), emptyMetric()),
      byClient: groupBy(records, (record) => record.client),
      byCapability: groupBy(records, (record) => record.capability),
      byProvider: groupBy(records, (record) => record.provider),
      byModel: groupBy(records, (record) => record.model)
    });
  }
});
