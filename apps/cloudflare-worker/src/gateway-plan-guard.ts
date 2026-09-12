import type { D1DatabaseLike } from "@ai-platform-core/storage";
import { checkUsageAllowance, consumeUsage, type PlanId } from "./plan-usage.js";

const PLAN_MANAGED_APPS = new Set(["numeria-studio", "velvet"]);
const PLAN_IDS = new Set<PlanId>(["free", "pro", "business"]);

interface GatewayBody {
  activity?: {
    client?: string;
    workspaceId?: string;
    userId?: string;
    capability?: string;
  };
}

export interface GatewayPlanContext {
  appId: string;
  appVersion: string;
  workspaceId: string;
  userId: string;
  planId: PlanId;
  featureKey: string;
  activityId: string;
  traceId: string | null;
  correlationId: string | null;
  eventName: string;
}

export interface GatewayPlanGuardResult {
  managed: boolean;
  allowed: boolean;
  status: number;
  context?: GatewayPlanContext;
  body?: unknown;
}

function readPlanId(value: string | null): PlanId | null {
  if (value === null || !PLAN_IDS.has(value as PlanId)) return null;
  return value as PlanId;
}

export async function readGatewayPlanContext(request: Request): Promise<GatewayPlanContext | null> {
  const body = (await request.clone().json()) as GatewayBody;
  const appId = request.headers.get("x-source-app") ?? body.activity?.client ?? "";
  if (!PLAN_MANAGED_APPS.has(appId)) return null;

  const appVersion = request.headers.get("x-app-version") ?? "";
  const workspaceId = body.activity?.workspaceId ?? "";
  const userId = body.activity?.userId ?? "";
  const featureKey = request.headers.get("x-feature-key") ?? body.activity?.capability ?? "";
  const planId = readPlanId(request.headers.get("x-plan-id"));
  const activityId = request.headers.get("x-activity-id") ?? "";

  if (!appVersion || !workspaceId || !userId || !featureKey || planId === null || !activityId) {
    throw new Error("PLAN_GATEWAY_CONTEXT_REQUIRED");
  }

  return {
    appId,
    appVersion,
    workspaceId,
    userId,
    planId,
    featureKey,
    activityId,
    traceId: request.headers.get("x-trace-id"),
    correlationId: request.headers.get("x-correlation-id"),
    eventName: "plan.usage.recorded.v1",
  };
}

async function hasManagedScopeMismatch(request: Request, context: GatewayPlanContext): Promise<boolean> {
  const body = (await request.clone().json()) as GatewayBody;
  const bodyClientId = body.activity?.client;
  const bodyCapability = body.activity?.capability;
  const sourceApp = request.headers.get("x-source-app");
  const clientId = request.headers.get("x-client-id");
  const featureKey = request.headers.get("x-feature-key");

  return (
    request.headers.get("x-workspace-id") !== context.workspaceId ||
    request.headers.get("x-user-id") !== context.userId ||
    (clientId !== null && clientId !== context.appId) ||
    (sourceApp !== null && bodyClientId !== undefined && sourceApp !== bodyClientId) ||
    (featureKey !== null && bodyCapability !== undefined && featureKey !== bodyCapability)
  );
}

export async function enforceGatewayPlan(
  request: Request,
  db: D1DatabaseLike,
): Promise<GatewayPlanGuardResult> {
  let context: GatewayPlanContext | null;
  try {
    context = await readGatewayPlanContext(request);
  } catch {
    return {
      managed: true,
      allowed: false,
      status: 400,
      body: {
        status: "error",
        errorCode: "PLAN_GATEWAY_CONTEXT_REQUIRED",
        message:
          "Managed AI requests require app, appVersion, workspace, user, plan, feature, and activity id context.",
      },
    };
  }

  if (context === null) return { managed: false, allowed: true, status: 200 };

  if (await hasManagedScopeMismatch(request, context)) {
    return {
      managed: true,
      allowed: false,
      status: 403,
      body: {
        status: "error",
        errorCode: "AUTHORIZATION_SCOPE_VIOLATION",
        appName: context.appId,
        appVersion: context.appVersion,
        featureKey: context.featureKey,
        planId: context.planId,
        entitlementResult: "denied",
        traceId: context.traceId,
        correlationId: context.correlationId,
      },
    };
  }

  const result = await checkUsageAllowance(db, context);
  if (!result.allowed) {
    return {
      managed: true,
      allowed: false,
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
        appName: context.appId,
        appVersion: context.appVersion,
        featureKey: context.featureKey,
        planId: context.planId,
        entitlementResult: result.entitlementResult,
        usagePeriod: result.usage.usagePeriod,
        usageCount: result.usage.usageCount,
        limit: result.usage.limit,
        overLimit: result.usage.overLimit,
        remaining: result.usage.remaining,
        resetAt: result.usage.resetAt,
        eventName: result.errorCode === "PLAN_LIMIT_EXCEEDED" ? "plan.usage_limit.reached.v1" : "plan.entitlement.checked.v1",
        traceId: context.traceId,
        correlationId: context.correlationId,
      },
    };
  }

  return { managed: true, allowed: true, status: 200, context };
}

export async function commitGatewayPlanUsage(
  db: D1DatabaseLike,
  context: GatewayPlanContext,
): Promise<void> {
  await consumeUsage(db, context);
}
