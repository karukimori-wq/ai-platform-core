import type { D1DatabaseLike } from "@ai-platform-core/storage";

export type PlanId = "free" | "pro" | "business";
export type UsagePeriod = "monthly" | "unlimited";
export type EntitlementResult = "allowed" | "denied" | "over_limit" | "unavailable";

export interface UsageQuery {
  appId: string;
  workspaceId: string;
  userId: string;
  planId: PlanId;
  featureKey: string;
}

export interface UsageSnapshot extends UsageQuery {
  period: string;
  usagePeriod: UsagePeriod;
  used: number;
  usageCount: number;
  limit: number | null;
  remaining: number | null;
  overLimit: boolean;
  resetAt: string | null;
}

export interface ConsumeUsageRequest extends UsageQuery {
  activityId: string;
  appVersion?: string;
  traceId?: string | null;
  correlationId?: string | null;
  eventName?: string;
  tokenEstimate?: number | null;
}

export interface ConsumeUsageResult {
  allowed: boolean;
  idempotentReplay: boolean;
  entitlementResult: EntitlementResult;
  errorCode?: "PLAN_LIMIT_EXCEEDED" | "PLAN_NOT_ALLOWED" | "CAPABILITY_DISABLED" | "BUSINESS_UNAVAILABLE";
  usage: UsageSnapshot;
}

/*
 * The shared plan contract does not define numeric AI-call quotas for the
 * current Free / Pro release. In particular, Numeria's 20/month limit is an
 * appraisal-completion limit owned by Numeria Studio, not an APC AI-call
 * quota. Keep AI usage measurable here, and only enforce a numeric limit when
 * the shared contract explicitly defines one in this table in the future.
 */
const AI_USAGE_LIMITS: Partial<Record<PlanId, Readonly<Record<string, number>>>> = {};

const FREE_AND_PRO_AI_FEATURES = new Set([
  // Legacy APC keys retained while app integrations migrate.
  "studio.report.generate",
  "studio.report.ai_assist",
]);

const PRO_ONLY_AI_FEATURES = new Set([
  // Canonical shared-plan keys.
  "numeria.report.wording_adjustment",
  "velvet.ai.organize_suggest",
  // Legacy APC keys retained as Pro-only compatibility aliases.
  "velvet.memory.summary",
  "velvet.memory.search",
  "velvet.memory.recall",
]);

const BUSINESS_ONLY_PREFIX = "business.";
export const BUSINESS_RELEASE_STATUS = "unavailable" as const;
export const BUSINESS_PURCHASABLE = false as const;

export function resolveMonthlyPeriod(now = new Date()): { period: string; resetAt: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const period = `${String(year)}-${String(month + 1).padStart(2, "0")}`;
  const resetAt = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0)).toISOString();
  return { period, resetAt };
}

export function resolveLimit(planId: PlanId, featureKey: string): number | null {
  return AI_USAGE_LIMITS[planId]?.[featureKey] ?? null;
}

export function isCapabilityAllowed(planId: PlanId, featureKey: string): boolean {
  if (planId === "business") return false;
  if (featureKey.startsWith(BUSINESS_ONLY_PREFIX)) return false;
  if (FREE_AND_PRO_AI_FEATURES.has(featureKey)) return true;
  if (PRO_ONLY_AI_FEATURES.has(featureKey)) return planId === "pro";
  return false;
}

const usageId = (query: UsageQuery, period: string) =>
  [query.appId, query.workspaceId, query.userId, query.planId, query.featureKey, period].join("|");

const idempotencyId = (request: ConsumeUsageRequest) =>
  `${request.appId}|${request.workspaceId}|${request.userId}|${request.activityId}`;

export async function getUsageSnapshot(
  db: D1DatabaseLike,
  query: UsageQuery,
  now = new Date(),
): Promise<UsageSnapshot> {
  const { period, resetAt } = resolveMonthlyPeriod(now);
  const id = usageId(query, period);
  const row = await db
    .prepare("SELECT value_json FROM platform_kv WHERE namespace=? AND id=? LIMIT 1")
    .bind("plan.usage", id)
    .first<{ value_json: string }>();
  const used = row ? ((JSON.parse(row.value_json) as { used?: number }).used ?? 0) : 0;
  const limit = resolveLimit(query.planId, query.featureKey);
  const overLimit = limit !== null && used >= limit;
  return {
    ...query,
    period,
    usagePeriod: limit === null ? "unlimited" : "monthly",
    used,
    usageCount: used,
    limit,
    remaining: limit === null ? null : Math.max(limit - used, 0),
    overLimit,
    resetAt: limit === null ? null : resetAt,
  };
}

export async function checkUsageAllowance(
  db: D1DatabaseLike,
  request: ConsumeUsageRequest,
  now = new Date(),
): Promise<ConsumeUsageResult> {
  const usage = await getUsageSnapshot(db, request, now);

  if (request.planId === "business") {
    return {
      allowed: false,
      idempotentReplay: false,
      entitlementResult: "unavailable",
      errorCode: "BUSINESS_UNAVAILABLE",
      usage,
    };
  }

  if (!isCapabilityAllowed(request.planId, request.featureKey)) {
    return {
      allowed: false,
      idempotentReplay: false,
      entitlementResult: "denied",
      errorCode: request.featureKey.startsWith(BUSINESS_ONLY_PREFIX)
        ? "PLAN_NOT_ALLOWED"
        : "CAPABILITY_DISABLED",
      usage,
    };
  }

  const existing = await db
    .prepare("SELECT id FROM platform_kv WHERE namespace=? AND id=? LIMIT 1")
    .bind("plan.usage.activity", idempotencyId(request))
    .first<{ id: string }>();
  if (existing?.id === idempotencyId(request)) {
    return { allowed: true, idempotentReplay: true, entitlementResult: "allowed", usage };
  }

  if (usage.overLimit) {
    return {
      allowed: false,
      idempotentReplay: false,
      entitlementResult: "over_limit",
      errorCode: "PLAN_LIMIT_EXCEEDED",
      usage,
    };
  }

  return { allowed: true, idempotentReplay: false, entitlementResult: "allowed", usage };
}

export async function consumeUsage(
  db: D1DatabaseLike,
  request: ConsumeUsageRequest,
  now = new Date(),
): Promise<ConsumeUsageResult> {
  const allowed = await checkUsageAllowance(db, request, now);
  if (!allowed.allowed || allowed.idempotentReplay) return allowed;

  const nextUsed = allowed.usage.used + 1;
  const nextUsage: UsageSnapshot = {
    ...allowed.usage,
    used: nextUsed,
    usageCount: nextUsed,
    remaining: allowed.usage.limit === null ? null : Math.max(allowed.usage.limit - nextUsed, 0),
    overLimit: allowed.usage.limit !== null && nextUsed >= allowed.usage.limit,
  };
  const nowIso = now.toISOString();
  const counterId = usageId(request, allowed.usage.period);

  await db
    .prepare("INSERT INTO platform_kv(namespace,id,value_json,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(namespace,id) DO UPDATE SET value_json=excluded.value_json,version=platform_kv.version+1,updated_at=excluded.updated_at")
    .bind("plan.usage", counterId, JSON.stringify({ used: nextUsed }), 1, nowIso)
    .run();
  await db
    .prepare("INSERT INTO platform_kv(namespace,id,value_json,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(namespace,id) DO NOTHING")
    .bind(
      "plan.usage.activity",
      idempotencyId(request),
      JSON.stringify({
        activityId: request.activityId,
        appName: request.appId,
        appVersion: request.appVersion ?? "unknown",
        featureKey: request.featureKey,
        planId: request.planId,
        traceId: request.traceId ?? null,
        correlationId: request.correlationId ?? null,
        eventName: request.eventName ?? "plan.usage.recorded.v1",
        tokenEstimate: request.tokenEstimate ?? null,
        status: "success",
      }),
      1,
      nowIso,
    )
    .run();

  return { allowed: true, idempotentReplay: false, entitlementResult: "allowed", usage: nextUsage };
}
