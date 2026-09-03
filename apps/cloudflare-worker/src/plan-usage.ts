import type { D1DatabaseLike } from "@ai-platform-core/storage";

export type PlanId = "free" | "pro" | "business";

export interface UsageQuery {
  appId: string;
  workspaceId: string;
  userId: string;
  planId: PlanId;
  featureKey: string;
}

export interface UsageSnapshot extends UsageQuery {
  period: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
}

export interface ConsumeUsageRequest extends UsageQuery {
  activityId: string;
}

export interface ConsumeUsageResult {
  allowed: boolean;
  idempotentReplay: boolean;
  errorCode?: "PLAN_LIMIT_EXCEEDED" | "PLAN_NOT_ALLOWED" | "CAPABILITY_DISABLED";
  usage: UsageSnapshot;
}

const FREE_LIMITS: Record<string, number> = {
  "studio.report.generate": 20,
  "studio.report.ai_assist": 20,
  "velvet.memory.summary": 100,
  "velvet.memory.search": 100,
  "velvet.memory.recall": 100,
};

const BUSINESS_ONLY_PREFIX = "business.";

export function resolveMonthlyPeriod(now = new Date()): { period: string; resetAt: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const period = `${year}-${String(month + 1).padStart(2, "0")}`;
  const resetAt = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0)).toISOString();
  return { period, resetAt };
}

export function resolveLimit(planId: PlanId, featureKey: string): number | null {
  if (planId === "pro" || planId === "business") return null;
  return FREE_LIMITS[featureKey] ?? 0;
}

export function isCapabilityAllowed(planId: PlanId, featureKey: string): boolean {
  if (featureKey.startsWith(BUSINESS_ONLY_PREFIX)) return planId === "business";
  if (planId === "free") return featureKey in FREE_LIMITS;
  return true;
}

const usageId = (query: UsageQuery, period: string) =>
  [query.appId, query.workspaceId, query.userId, query.planId, query.featureKey, period].join("|");

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
  const used = row ? Number((JSON.parse(row.value_json) as { used?: number }).used ?? 0) : 0;
  const limit = resolveLimit(query.planId, query.featureKey);
  return {
    ...query,
    period,
    used,
    limit,
    remaining: limit === null ? null : Math.max(limit - used, 0),
    resetAt: limit === null ? null : resetAt,
  };
}

export async function consumeUsage(
  db: D1DatabaseLike,
  request: ConsumeUsageRequest,
  now = new Date(),
): Promise<ConsumeUsageResult> {
  const usage = await getUsageSnapshot(db, request, now);

  if (!isCapabilityAllowed(request.planId, request.featureKey)) {
    return {
      allowed: false,
      idempotentReplay: false,
      errorCode: request.featureKey.startsWith(BUSINESS_ONLY_PREFIX)
        ? "PLAN_NOT_ALLOWED"
        : "CAPABILITY_DISABLED",
      usage,
    };
  }

  const idempotencyId = `${request.appId}|${request.workspaceId}|${request.userId}|${request.activityId}`;
  const existing = await db
    .prepare("SELECT id FROM platform_kv WHERE namespace=? AND id=? LIMIT 1")
    .bind("plan.usage.activity", idempotencyId)
    .first<{ id: string }>();
  if (existing?.id === idempotencyId) {
    return { allowed: true, idempotentReplay: true, usage };
  }

  if (usage.limit !== null && usage.used >= usage.limit) {
    return { allowed: false, idempotentReplay: false, errorCode: "PLAN_LIMIT_EXCEEDED", usage };
  }

  const nextUsed = usage.used + 1;
  const nextUsage = { ...usage, used: nextUsed, remaining: usage.limit === null ? null : Math.max(usage.limit - nextUsed, 0) };
  const nowIso = now.toISOString();
  const counterId = usageId(request, usage.period);

  await db
    .prepare("INSERT INTO platform_kv(namespace,id,value_json,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(namespace,id) DO UPDATE SET value_json=excluded.value_json,version=platform_kv.version+1,updated_at=excluded.updated_at")
    .bind("plan.usage", counterId, JSON.stringify({ used: nextUsed }), 1, nowIso)
    .run();
  await db
    .prepare("INSERT INTO platform_kv(namespace,id,value_json,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(namespace,id) DO NOTHING")
    .bind(
      "plan.usage.activity",
      idempotencyId,
      JSON.stringify({
        activityId: request.activityId,
        appName: request.appId,
        featureKey: request.featureKey,
        planId: request.planId,
      }),
      1,
      nowIso,
    )
    .run();

  return { allowed: true, idempotentReplay: false, usage: nextUsage };
}
