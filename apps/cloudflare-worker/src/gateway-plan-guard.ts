import type { D1DatabaseLike } from "@ai-platform-core/storage";
import { consumeUsage, type PlanId } from "./plan-usage.js";

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
  workspaceId: string;
  userId: string;
  planId: PlanId;
  featureKey: string;
  activityId: string;
  traceId: string | null;
  correlationId: string | null;
}

export interface GatewayPlanGuardResult {
  managed: boolean;
  allowed: boolean;
  status: number;
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

  const workspaceId = body.activity?.workspaceId ?? "";
  const userId = body.activity?.userId ?? "";
  const featureKey = request.headers.get("x-feature-key") ?? body.activity?.capability ?? "";
  const planId = readPlanId(request.headers.get("x-plan-id"));
  const activityId = request.headers.get("x-activity-id") ?? "";

  if (!workspaceId || !userId || !featureKey || planId === null || !activityId) {
    throw new Error("PLAN_GATEWAY_CONTEXT_REQUIRED");
  }

  return {
    appId,
    workspaceId,
    userId,
    planId,
    featureKey,
    activityId,
    traceId: request.headers.get("x-trace-id"),
    correlationId: request.headers.get("x-correlation-id"),
  };
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
          "Managed AI requests require app, workspace, user, plan, feature, and activity id context.",
      },
    };
  }

  if (context === null) return { managed: false, allowed: true, status: 200 };

  if (
    request.headers.get("x-workspace-id") !== context.workspaceId ||
    request.headers.get("x-user-id") !== context.userId
  ) {
    return {
      managed: true,
      allowed: false,
      status: 403,
      body: {
        status: "error",
        errorCode: "AUTHORIZATION_SCOPE_VIOLATION",
        appName: context.appId,
        featureKey: context.featureKey,
        planId: context.planId,
        traceId: context.traceId,
        correlationId: context.correlationId,
      },
    };
  }

  const result = await consumeUsage(db, context);
  if (!result.allowed) {
    return {
      managed: true,
      allowed: false,
      status: result.errorCode === "PLAN_LIMIT_EXCEEDED" ? 429 : 403,
      body: {
        status: "error",
        errorCode: result.errorCode,
        appName: context.appId,
        featureKey: context.featureKey,
        planId: context.planId,
        remaining: result.usage.remaining,
        resetAt: result.usage.resetAt,
        traceId: context.traceId,
        correlationId: context.correlationId,
      },
    };
  }

  return { managed: true, allowed: true, status: 200 };
}
