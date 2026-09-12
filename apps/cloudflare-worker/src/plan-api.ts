import type { D1DatabaseLike } from "@ai-platform-core/storage";
import {
  BUSINESS_PURCHASABLE,
  BUSINESS_RELEASE_STATUS,
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

interface PlanScope extends UsageQuery {
  appVersion: string;
  traceId: string | null;
  correlationId: string | null;
}

interface UsageConsumeBody {
  activityId?: string;
  traceId?: string;
  correlationId?: string;
  eventName?: string;
  tokenEstimate?: number;
  appVersion?: string;
}

const USAGE_BODY_FIELDS = new Set([
  "activityId",
  "traceId",
  "correlationId",
  "eventName",
  "tokenEstimate",
  "appVersion",
]);

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

function readScope(request: Request): PlanScope | PlanApiResponse {
  const url = new URL(request.url);
  const appId = url.searchParams.get("appId");
  const workspaceId = url.searchParams.get("workspaceId");
  const userId = url.searchParams.get("userId");
  const planId = url.searchParams.get("planId") as PlanId | null;
  const featureKey = url.searchParams.get("featureKey");
  const appVersion = url.searchParams.get("appVersion") ?? request.headers.get("x-app-version") ?? "unknown";

  if (!appId || !workspaceId || !userId || !planId || !featureKey) {
    return badRequest("appId, workspaceId, userId, planId, and featureKey are required.");
  }
  if (!PLAN_IDS.has(planId)) return badRequest("planId must be free, pro, or business.");
  if (
    request.headers.get("x-client-id") !== appId ||
    request.headers.get("x-workspace-id") !== workspaceId ||
    request.headers.get("x-user-id") !== userId
  ) {
    return forbidden();
  }
  return {
    appId,
    workspaceId,
    userId,
    planId,
    featureKey,
    appVersion,
    traceId: request.headers.get("x-trace-id"),
    correlationId: request.headers.get("x-correlation-id"),
  };
}

function isError(value: PlanScope | PlanApiResponse): value is PlanApiResponse {
  return "body" in value && "status" in value;
}

const entitlementResult = (scope: PlanScope, allowed: boolean, overLimit: boolean) => {
  if (scope.planId === "business") return "unavailable" as const;
  if (overLimit) return "over_limit" as const;
  return allowed ? ("allowed" as const) : ("denied" as const);
};

const businessState = (planId: PlanId) =>
  planId === "business"
    ? { releaseStatus: BUSINESS_RELEASE_STATUS, purchasable: BUSINESS_PURCHASABLE }
    : { releaseStatus: "ready" as const, purchasable: true };

export async function handleUsageRead(request: Request, db: D1DatabaseLike): Promise<PlanApiResponse> {
  const scope = readScope(request);
  if (isError(scope)) return scope;
  const usage = await getUsageSnapshot(db, scope);
  return {
    status: 200,
    body: {
      status: "success",
      appName: scope.appId,
      appVersion: scope.appVersion,
      currentPlan: scope.planId,
      planId: scope.planId,
      featureKey: scope.featureKey,
      usagePeriod: usage.usagePeriod,
      usageCount: usage.usageCount,
      limit: usage.limit,
      overLimit: usage.overLimit,
      remaining: usage.remaining,
      resetAt: usage.resetAt,
      entitlementResult: entitlementResult(scope, isCapabilityAllowed(scope.planId, scope.featureKey), usage.overLimit),
      traceId: scope.traceId,
      correlationId: scope.correlationId,
      ...businessState(scope.planId),
      period: usage.period,
      used: usage.used,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function handleEntitlementRead(request: Request, db: D1DatabaseLike): Promise<PlanApiResponse> {
  const scope = readScope(request);
  if (isError(scope)) return scope;
  const usage = await getUsageSnapshot(db, scope);
  const allowed = isCapabilityAllowed(scope.planId, scope.featureKey) && !usage.overLimit;
  return {
    status: 200,
    body: {
      status: "success",
      appName: scope.appId,
      appVersion: scope.appVersion,
      appId: scope.appId,
      workspaceId: scope.workspaceId,
      userId: scope.userId,
      planId: scope.planId,
      featureKey: scope.featureKey,
      allowed,
      entitlementResult: entitlementResult(scope, allowed, usage.overLimit),
      usagePeriod: usage.usagePeriod,
      usagePolicy: usage.usagePeriod,
      usageCount: usage.usageCount,
      limit: usage.limit,
      overLimit: usage.overLimit,
      used: usage.used,
      remaining: usage.remaining,
      resetAt: usage.resetAt,
      traceId: scope.traceId,
      correlationId: scope.correlationId,
      ...businessState(scope.planId),
      timestamp: new Date().toISOString(),
    },
  };
}

export async function handleUsageConsume(request: Request, db: D1DatabaseLike): Promise<PlanApiResponse> {
  const scope = readScope(request);
  if (isError(scope)) return scope;
  let body: UsageConsumeBody = {};
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const unsupported = Object.keys(raw).filter((key) => !USAGE_BODY_FIELDS.has(key));
    if (unsupported.length > 0) {
      return badRequest(`Usage payload contains unsupported fields: ${unsupported.join(", ")}.`);
    }
    body = raw as UsageConsumeBody;
  } catch {
    return badRequest("A JSON body is required.");
  }
  if (!body.activityId) return badRequest("activityId is required.");
  if (body.tokenEstimate !== undefined && (!Number.isFinite(body.tokenEstimate) || body.tokenEstimate < 0)) {
    return badRequest("tokenEstimate must be a non-negative number.");
  }

  const appVersion = body.appVersion ?? scope.appVersion;
  const traceId = body.traceId ?? scope.traceId;
  const correlationId = body.correlationId ?? scope.correlationId;
  const eventName = body.eventName ?? "plan.usage.recorded.v1";
  const tokenEstimate = body.tokenEstimate ?? null;
  const result = await consumeUsage(db, {
    ...scope,
    activityId: body.activityId,
    appVersion,
    traceId,
    correlationId,
    eventName,
    tokenEstimate,
  });
  if (!result.allowed) {
    return {
      status: result.errorCode === "PLAN_LIMIT_EXCEEDED" ? 429 : 403,
      body: {
        status: "error",
        errorCode: result.errorCode,
        message:
          result.errorCode === "PLAN_LIMIT_EXCEEDED"
            ? "The plan usage limit has been reached for this feature."
            : result.errorCode === "BUSINESS_UNAVAILABLE"
              ? "Business is not available in the current Free / Pro release."
              : "The current plan is not entitled to this AI feature.",
        appName: scope.appId,
        appVersion,
        featureKey: scope.featureKey,
        planId: scope.planId,
        entitlementResult: result.entitlementResult,
        usagePeriod: result.usage.usagePeriod,
        usageCount: result.usage.usageCount,
        limit: result.usage.limit,
        overLimit: result.usage.overLimit,
        remaining: result.usage.remaining,
        resetAt: result.usage.resetAt,
        eventName: result.errorCode === "PLAN_LIMIT_EXCEEDED" ? "plan.usage_limit.reached.v1" : "plan.entitlement.checked.v1",
        traceId,
        correlationId,
        ...businessState(scope.planId),
      },
    };
  }
  return {
    status: 200,
    body: {
      status: "success",
      appName: scope.appId,
      appVersion,
      featureKey: scope.featureKey,
      planId: scope.planId,
      activityId: body.activityId,
      eventName,
      tokenEstimate,
      entitlementResult: result.entitlementResult,
      idempotentReplay: result.idempotentReplay,
      usagePeriod: result.usage.usagePeriod,
      usageCount: result.usage.usageCount,
      limit: result.usage.limit,
      overLimit: result.usage.overLimit,
      remaining: result.usage.remaining,
      resetAt: result.usage.resetAt,
      usage: result.usage,
      traceId,
      correlationId,
      ...businessState(scope.planId),
    },
  };
}

export function getAppEntitlementDefinitions(appId: string, planId: PlanId) {
  const features = FEATURE_KEYS[appId] ?? [];
  return features.map((featureKey) => ({
    featureKey,
    allowed: isCapabilityAllowed(planId, featureKey),
    entitlementResult: planId === "business" ? "unavailable" : isCapabilityAllowed(planId, featureKey) ? "allowed" : "denied",
    usagePolicy: planId === "business" ? "unavailable" : resolveLimit(planId, featureKey) === null ? "unlimited" : "monthly",
    limit: resolveLimit(planId, featureKey),
    ...businessState(planId),
  }));
}
