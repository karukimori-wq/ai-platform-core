import type { D1DatabaseLike } from "@ai-platform-core/storage";
import {
  consumeUsage,
  getUsageSnapshot,
  isCapabilityAllowed,
  resolveLimit,
  type PlanId,
  type UsageQuery,
} from "./plan-usage.js";

const PLAN_IDS = new Set<PlanId>(["free", "pro", "business"]);

const FEATURE_KEYS: Record<string, string[]> = {
  "numeria-studio": ["studio.report.generate", "studio.report.ai_assist"],
  velvet: ["velvet.memory.summary", "velvet.memory.search", "velvet.memory.recall"],
};

export interface PlanApiResponse {
  body: unknown;
  status: number;
}

function badRequest(message: string): PlanApiResponse {
  return { body: { status: "error", errorCode: "HTTP_INVALID_QUERY", message }, status: 400 };
}

function forbidden(): PlanApiResponse {
  return {
    body: {
      status: "error",
      errorCode: "AUTHORIZATION_SCOPE_VIOLATION",
      message: "Request scope must match appId, workspaceId, and userId.",
    },
    status: 403,
  };
}

function readScope(request: Request): UsageQuery | PlanApiResponse {
  const url = new URL(request.url);
  const appId = url.searchParams.get("appId");
  const workspaceId = url.searchParams.get("workspaceId");
  const userId = url.searchParams.get("userId");
  const planId = url.searchParams.get("planId") as PlanId | null;
  const featureKey = url.searchParams.get("featureKey");

  if (!appId || !workspaceId || !userId || !planId || !featureKey) {
    return badRequest("Query parameters appId, workspaceId, userId, planId, and featureKey are required.");
  }
  if (!PLAN_IDS.has(planId)) return badRequest("planId must be free, pro, or business.");
  if (
    request.headers.get("x-client-id") !== appId ||
    request.headers.get("x-workspace-id") !== workspaceId ||
    request.headers.get("x-user-id") !== userId
  ) {
    return forbidden();
  }
  return { appId, workspaceId, userId, planId, featureKey };
}

function isError(value: UsageQuery | PlanApiResponse): value is PlanApiResponse {
  return "body" in value && "status" in value;
}

export async function handleUsageRead(request: Request, db: D1DatabaseLike): Promise<PlanApiResponse> {
  const scope = readScope(request);
  if (isError(scope)) return scope;
  const usage = await getUsageSnapshot(db, scope);
  return {
    status: 200,
    body: {
      status: "success",
      appName: "ai-platform-core",
      currentPlan: scope.planId,
      usagePeriod: usage.limit === null ? "unlimited" : "monthly",
      ...usage,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function handleEntitlementRead(request: Request, db: D1DatabaseLike): Promise<PlanApiResponse> {
  const scope = readScope(request);
  if (isError(scope)) return scope;
  const usage = await getUsageSnapshot(db, scope);
  const allowed = isCapabilityAllowed(scope.planId, scope.featureKey) && (usage.limit === null || usage.used < usage.limit);
  return {
    status: 200,
    body: {
      status: "success",
      appName: "ai-platform-core",
      appId: scope.appId,
      workspaceId: scope.workspaceId,
      userId: scope.userId,
      planId: scope.planId,
      featureKey: scope.featureKey,
      allowed,
      usagePolicy: usage.limit === null ? "unlimited" : "monthly",
      limit: usage.limit,
      used: usage.used,
      remaining: usage.remaining,
      resetAt: usage.resetAt,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function handleUsageConsume(request: Request, db: D1DatabaseLike): Promise<PlanApiResponse> {
  const scope = readScope(request);
  if (isError(scope)) return scope;
  let body: { activityId?: string; traceId?: string; correlationId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("A JSON body is required.");
  }
  if (!body.activityId) return badRequest("activityId is required.");
  const result = await consumeUsage(db, { ...scope, activityId: body.activityId });
  if (!result.allowed) {
    return {
      status: result.errorCode === "PLAN_LIMIT_EXCEEDED" ? 429 : 403,
      body: {
        status: "error",
        errorCode: result.errorCode,
        appName: scope.appId,
        featureKey: scope.featureKey,
        planId: scope.planId,
        remaining: result.usage.remaining,
        resetAt: result.usage.resetAt,
        traceId: body.traceId ?? null,
        correlationId: body.correlationId ?? null,
      },
    };
  }
  return {
    status: 200,
    body: {
      status: "success",
      appName: scope.appId,
      featureKey: scope.featureKey,
      planId: scope.planId,
      activityId: body.activityId,
      idempotentReplay: result.idempotentReplay,
      usage: result.usage,
      traceId: body.traceId ?? null,
      correlationId: body.correlationId ?? null,
    },
  };
}

export function getAppEntitlementDefinitions(appId: string, planId: PlanId) {
  const features = FEATURE_KEYS[appId] ?? [];
  return features.map((featureKey) => ({
    featureKey,
    allowed: isCapabilityAllowed(planId, featureKey),
    usagePolicy: resolveLimit(planId, featureKey) === null ? "unlimited" : "monthly",
    limit: resolveLimit(planId, featureKey),
  }));
}
