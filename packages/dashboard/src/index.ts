import type { ActivityFeedback, ActivityOutcome } from "@ai-platform-core/activity";
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
  readonly outcomeCount: number;
  readonly averageOutcomeScore: number;
  readonly averageRoi: number;
  readonly feedbackCount: number;
  readonly acceptedCount: number;
  readonly editedCount: number;
  readonly averageRating: number;
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
  averageLatencyMs: 0,
  outcomeCount: 0,
  averageOutcomeScore: 0,
  averageRoi: 0,
  feedbackCount: 0,
  acceptedCount: 0,
  editedCount: 0,
  averageRating: 0
});

interface ActivitySignals {
  readonly outcome?: ActivityOutcome;
  readonly feedback?: ActivityFeedback;
}

interface MetricAccumulator {
  readonly metric: DashboardMetric;
  readonly outcomeScoreCount: number;
  readonly roiCount: number;
  readonly ratingCount: number;
}

const emptyAccumulator = (): MetricAccumulator => ({
  metric: emptyMetric(),
  outcomeScoreCount: 0,
  roiCount: 0,
  ratingCount: 0
});

const averageWithNext = (currentAverage: number, currentCount: number, next: number): number =>
  (currentAverage * currentCount + next) / (currentCount + 1);

const addRecord = (accumulator: MetricAccumulator, record: UsageRecord, signals: ActivitySignals): MetricAccumulator => {
  const usageCount = accumulator.metric.usageCount + 1;
  const latencyTotal = accumulator.metric.averageLatencyMs * accumulator.metric.usageCount + record.latencyMs;
  const outcomeCount = signals.outcome === undefined ? accumulator.metric.outcomeCount : accumulator.metric.outcomeCount + 1;
  const feedbackCount = signals.feedback === undefined ? accumulator.metric.feedbackCount : accumulator.metric.feedbackCount + 1;
  const outcomeScoreCount = signals.outcome?.score === undefined ? accumulator.outcomeScoreCount : accumulator.outcomeScoreCount + 1;
  const roiCount = signals.outcome?.roi === undefined ? accumulator.roiCount : accumulator.roiCount + 1;
  const ratingCount = signals.feedback?.rating === undefined ? accumulator.ratingCount : accumulator.ratingCount + 1;
  return {
    metric: {
      usageCount,
      totalTokens: accumulator.metric.totalTokens + record.totalTokens,
      totalCost: accumulator.metric.totalCost + record.costAmount,
      averageLatencyMs: latencyTotal / usageCount,
      outcomeCount,
      averageOutcomeScore:
        signals.outcome?.score === undefined
          ? accumulator.metric.averageOutcomeScore
          : averageWithNext(accumulator.metric.averageOutcomeScore, accumulator.outcomeScoreCount, signals.outcome.score),
      averageRoi:
        signals.outcome?.roi === undefined
          ? accumulator.metric.averageRoi
          : averageWithNext(accumulator.metric.averageRoi, accumulator.roiCount, signals.outcome.roi),
      feedbackCount,
      acceptedCount: accumulator.metric.acceptedCount + (signals.feedback?.accepted === true ? 1 : 0),
      editedCount: accumulator.metric.editedCount + (signals.feedback?.edited === true ? 1 : 0),
      averageRating:
        signals.feedback?.rating === undefined
          ? accumulator.metric.averageRating
          : averageWithNext(accumulator.metric.averageRating, accumulator.ratingCount, signals.feedback.rating)
    },
    outcomeScoreCount,
    roiCount,
    ratingCount
  };
};

const groupBy = (
  records: readonly UsageRecord[],
  signalsByActivityId: ReadonlyMap<string, ActivitySignals>,
  keyOf: (record: UsageRecord) => string
): Readonly<Record<string, MetricAccumulator>> =>
  records.reduce<Readonly<Record<string, MetricAccumulator>>>((acc, record) => {
    const key = keyOf(record);
    return { ...acc, [key]: addRecord(acc[key] ?? emptyAccumulator(), record, signalsByActivityId.get(record.activityId) ?? {}) };
  }, {});

const toMetrics = (
  accumulators: Readonly<Record<string, MetricAccumulator>>
): Readonly<Record<string, DashboardMetric>> =>
  Object.fromEntries(Object.entries(accumulators).map(([key, accumulator]) => [key, accumulator.metric]));

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

const createActivitySignals = (
  activityId: string,
  outcomesByActivityId: ReadonlyMap<string, ActivityOutcome>,
  feedbackByActivityId: ReadonlyMap<string, ActivityFeedback>
): ActivitySignals => {
  const outcome = outcomesByActivityId.get(activityId);
  const feedback = feedbackByActivityId.get(activityId);
  return {
    ...(outcome === undefined ? {} : { outcome }),
    ...(feedback === undefined ? {} : { feedback })
  };
};

export const createDashboardQueryService = (
  analytics: AnalyticsRepository,
  clock: Clock
): DashboardQueryService => ({
  getView: async (query) => {
    const usage = await analytics.listUsage();
    if (!usage.ok) return usage;
    const outcomes = await analytics.listOutcomes();
    if (!outcomes.ok) return outcomes;
    const feedback = await analytics.listFeedback();
    if (!feedback.ok) return feedback;
    const now = query.now ?? clock.now();
    const records = filterByPeriod(usage.value, query.period, now);
    const outcomesByActivityId = new Map(outcomes.value.map((outcome) => [outcome.activityId, outcome]));
    const feedbackByActivityId = new Map(feedback.value.map((item) => [item.activityId, item]));
    const signalsByActivityId = new Map<string, ActivitySignals>(
      records.map((record) => [
        record.activityId,
        createActivitySignals(record.activityId, outcomesByActivityId, feedbackByActivityId)
      ])
    );
    return ok({
      period: query.period,
      metric: records.reduce((metric, record) => addRecord(metric, record, signalsByActivityId.get(record.activityId) ?? {}), emptyAccumulator()).metric,
      byClient: toMetrics(groupBy(records, signalsByActivityId, (record) => record.client)),
      byCapability: toMetrics(groupBy(records, signalsByActivityId, (record) => record.capability)),
      byProvider: toMetrics(groupBy(records, signalsByActivityId, (record) => record.provider)),
      byModel: toMetrics(groupBy(records, signalsByActivityId, (record) => record.model))
    });
  }
});
