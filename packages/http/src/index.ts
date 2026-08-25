import type {
  Activity,
  ActivityBudget,
  ActivityFeedback,
  ActivityOutcome,
  ActivityRequest,
  ActivityStatus
} from "@ai-platform-core/activity";
import type { GatewayAuthContext, GatewayRequest } from "@ai-platform-core/gateway";
import { type PlatformError, err, platformError } from "@ai-platform-core/kernel";
import type { AIMessage } from "@ai-platform-core/provider";
import type {
  PlatformRuntime,
  PromptTemplate,
  PromptTemplateRenderRequest,
  PromptTemplateRenderResult
} from "@ai-platform-core/runtime";

export interface GatewayHttpHandlerOptions {
  readonly route?: string;
}

export interface PlatformHttpHandlerOptions {
  readonly gatewayRunRoute?: string;
  readonly analyticsUsageRoute?: string;
  readonly dashboardUsageRoute?: string;
  readonly healthRoute?: string;
  readonly versionRoute?: string;
  readonly contractStatusRoute?: string;
  readonly activityRoutePrefix?: string;
  readonly capabilityRegisterRoute?: string;
  readonly promptTemplateRenderRoute?: string;
  readonly authorizeScopedRequest?: (
    request: Request,
    scope: ScopedAuthorizationRequest
  ) => Promise<boolean> | boolean;
  readonly authorizeUsageRequest?: (request: Request, clientId: string) => Promise<boolean> | boolean;
}

export interface ScopedAuthorizationRequest {
  readonly clientId: string;
  readonly workspaceId?: string;
  readonly userId?: string;
  readonly ownerUserId?: string;
}

export interface GatewayRunHttpBody {
  readonly auth: GatewayAuthContext;
  readonly activity: ActivityRequest;
  readonly messages: readonly AIMessage[];
}

export interface CapabilityRegisterHttpBody {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly permission: string;
  readonly input: string;
  readonly output: string;
}

export interface CapabilityHttpView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly permission: string;
  readonly input: string;
  readonly output: string;
}

export type PromptTemplateRenderHttpBody = PromptTemplateRenderRequest;

export type PromptTemplateRenderHttpView = PromptTemplateRenderResult;

export type PromptTemplateCreateHttpBody = PromptTemplate;

export type UsageHttpPeriod = "today" | "month" | "year" | "all";

export interface ActivityHttpView {
  readonly id: string;
  readonly client: string;
  readonly workspaceId?: string;
  readonly userId?: string;
  readonly ownerUserId?: string;
  readonly capability: string;
  readonly workflow?: string;
  readonly status: ActivityStatus;
  readonly provider?: string;
  readonly model?: string;
  readonly tokens?: {
    readonly input: number;
    readonly output: number;
    readonly total: number;
  };
  readonly cost?: {
    readonly amount: number;
    readonly currency: string;
  };
  readonly latencyMs?: number;
  readonly knowledgeUsed?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface UsageHttpBreakdownItem {
  readonly usageCount: number;
  readonly totalTokens: number;
  readonly totalCost: number;
}

export interface PlatformHealthView {
  readonly appName: "ai-platform-core";
  readonly status: "ok";
  readonly timestamp: string;
}

export interface PlatformVersionView {
  readonly appName: "ai-platform-core";
  readonly appVersion: string;
  readonly contractVersion: string;
  readonly commitSha?: string;
  readonly timestamp: string;
}

export interface PlatformContractStatusView {
  readonly appName: "ai-platform-core";
  readonly status: "ok" | "warning" | "error";
  readonly contractVersion: string;
  readonly identityMode: "workspaceId+userId";
  readonly professionalIdRequired: false;
  readonly usesLegacyEventNames: boolean;
  readonly usesReportTerminology: boolean;
  readonly canonicalOwnershipChecked: boolean;
  readonly authenticationContract: {
    readonly status: "mvp_scoped_headers";
    readonly identityMode: "workspaceId+userId";
    readonly requiredReadScope: readonly ["clientId", "workspaceId", "userId"];
    readonly professionalIdRequired: false;
  };
  readonly issues: readonly string[];
  readonly timestamp: string;
}

const jsonHeaders = { "content-type": "application/json" };

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const errorResponse = (status: number, error: PlatformError): Response =>
  jsonResponse(status, { ok: false, error });

const isPlatformError = (value: unknown): value is PlatformError =>
  isRecord(value) && typeof value.code === "string" && typeof value.message === "string";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (source: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
};

const readRecord = (
  source: Readonly<Record<string, unknown>>,
  key: string
): Readonly<Record<string, unknown>> | undefined => {
  const value = source[key];
  return isRecord(value) ? value : undefined;
};

const readStringArray = (
  source: Readonly<Record<string, unknown>>,
  key: string
): readonly string[] | undefined => {
  const value = source[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
};

const readBudget = (source: Readonly<Record<string, unknown>>, key: string): ActivityBudget | undefined => {
  const value = source[key];
  if (!isRecord(value)) return undefined;
  return {
    ...(typeof value.maxTokens === "number" ? { maxTokens: value.maxTokens } : {}),
    ...(typeof value.maxCost === "number" ? { maxCost: value.maxCost } : {}),
    ...(typeof value.currency === "string" ? { currency: value.currency } : {})
  };
};

const readMessages = (source: Readonly<Record<string, unknown>>): readonly AIMessage[] | undefined => {
  const value = source.messages;
  if (!Array.isArray(value)) return undefined;
  const messages = value.filter((item): item is Readonly<Record<string, unknown>> => isRecord(item));
  if (messages.length !== value.length) return undefined;
  return messages.map((message) => ({
    role: readMessageRole(message.role),
    content: typeof message.content === "string" ? message.content : ""
  })).filter((message) => message.role !== undefined && message.content.length > 0) as readonly AIMessage[];
};

const readMessageRole = (value: unknown): AIMessage["role"] | undefined =>
  value === "system" || value === "user" || value === "assistant" || value === "tool" ? value : undefined;

const parseGatewayRunBody = (value: unknown): GatewayRunHttpBody | PlatformError => {
  if (!isRecord(value)) {
    return platformError("HTTP_INVALID_BODY", "Request body must be a JSON object.");
  }
  const auth = readRecord(value, "auth");
  const activity = readRecord(value, "activity");
  const messages = readMessages(value);
  if (auth === undefined || activity === undefined || messages === undefined) {
    return platformError("HTTP_INVALID_BODY", "Request body must include auth, activity, and messages.");
  }

  const clientId = readString(auth, "clientId");
  const client = readString(activity, "client");
  const capability = readString(activity, "capability");
  const goal = readString(activity, "goal");
  const context = readRecord(activity, "context");
  const input = readRecord(activity, "input");
  if (
    clientId === undefined ||
    client === undefined ||
    capability === undefined ||
    goal === undefined ||
    context === undefined ||
    input === undefined
  ) {
    return platformError("HTTP_INVALID_BODY", "Request body has invalid auth or activity fields.");
  }

  const workflow = readString(activity, "workflow");
  const workspaceId = readString(activity, "workspaceId");
  const userId = readString(activity, "userId");
  const ownerUserId = readString(activity, "ownerUserId");
  const budget = readBudget(activity, "budget");
  const provider = readString(activity, "provider");
  const model = readString(activity, "model");
  const activityRequest: ActivityRequest = {
    client,
    ...(workspaceId === undefined ? {} : { workspaceId }),
    ...(userId === undefined ? {} : { userId }),
    ...(ownerUserId === undefined ? {} : { ownerUserId }),
    capability,
    goal,
    context,
    input,
    ...(workflow === undefined ? {} : { workflow }),
    ...(budget === undefined ? {} : { budget }),
    ...(provider === undefined ? {} : { provider }),
    ...(model === undefined ? {} : { model })
  };

  return {
    auth: {
      clientId,
      permissions: readStringArray(auth, "permissions") ?? []
    },
    activity: activityRequest,
    messages
  };
};

const parseCapabilityRegisterBody = (value: unknown): CapabilityRegisterHttpBody | PlatformError => {
  if (!isRecord(value)) {
    return platformError("HTTP_INVALID_BODY", "Request body must be a JSON object.");
  }
  const id = readString(value, "id");
  const name = readString(value, "name");
  const description = readString(value, "description");
  const permission = readString(value, "permission");
  const input = readString(value, "input");
  const output = readString(value, "output");
  if (
    id === undefined ||
    name === undefined ||
    description === undefined ||
    permission === undefined ||
    input === undefined ||
    output === undefined
  ) {
    return platformError("HTTP_INVALID_BODY", "Request body has invalid capability fields.");
  }
  return { id, name, description, permission, input, output };
};

const parsePromptTemplateRenderBody = (value: unknown): PromptTemplateRenderHttpBody | PlatformError => {
  if (!isRecord(value)) {
    return platformError("HTTP_INVALID_BODY", "Request body must be a JSON object.");
  }
  const templateId = readString(value, "templateId");
  const variables = readRecord(value, "variables");
  if (templateId === undefined || variables === undefined) {
    return platformError("HTTP_INVALID_BODY", "Request body has invalid prompt template fields.");
  }
  const version = typeof value.version === "number" ? value.version : undefined;
  const renderVariables: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(variables)) {
    if (typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") {
      return platformError("HTTP_INVALID_BODY", "Prompt template variables must be strings, numbers, or booleans.");
    }
    renderVariables[key] = item;
  }
  return { templateId, ...(version === undefined ? {} : { version }), variables: renderVariables };
};

const parsePromptTemplateCreateBody = (value: unknown): PromptTemplateCreateHttpBody | PlatformError => {
  if (!isRecord(value)) {
    return platformError("HTTP_INVALID_BODY", "Request body must be a JSON object.");
  }
  const id = readString(value, "id");
  const body = readString(value, "body");
  const version = typeof value.version === "number" ? value.version : undefined;
  const retention = readString(value, "retention");
  if (id === undefined || version === undefined || body === undefined) {
    return platformError("HTTP_INVALID_BODY", "Request body must include id, version, and body.");
  }
  if (retention !== "none" && retention !== "metadata" && retention !== "rendered") {
    return platformError("HTTP_INVALID_BODY", "Prompt template retention must be none, metadata, or rendered.");
  }
  return { id, version, body, retention };
};

const parseActivityOutcomeBody = (activityId: string, value: unknown): ActivityOutcome | PlatformError => {
  if (!isRecord(value)) {
    return platformError("HTTP_INVALID_BODY", "Request body must be a JSON object.");
  }
  const result = readString(value, "result");
  const score = typeof value.score === "number" ? value.score : undefined;
  const roi = typeof value.roi === "number" ? value.roi : undefined;
  if (result === undefined) {
    return platformError("HTTP_INVALID_BODY", "Request body must include result.");
  }
  return {
    activityId,
    result,
    ...(score === undefined ? {} : { score }),
    ...(roi === undefined ? {} : { roi })
  };
};

const parseActivityFeedbackBody = (activityId: string, value: unknown): ActivityFeedback | PlatformError => {
  if (!isRecord(value)) {
    return platformError("HTTP_INVALID_BODY", "Request body must be a JSON object.");
  }
  const edited = typeof value.edited === "boolean" ? value.edited : undefined;
  const accepted = typeof value.accepted === "boolean" ? value.accepted : undefined;
  const rating = typeof value.rating === "number" ? value.rating : undefined;
  const memo = readString(value, "memo");
  if (edited === undefined || accepted === undefined) {
    return platformError("HTTP_INVALID_BODY", "Request body must include edited and accepted.");
  }
  return {
    activityId,
    ...(rating === undefined ? {} : { rating }),
    edited,
    accepted,
    ...(memo === undefined ? {} : { memo })
  };
};

const runGateway = async (runtime: PlatformRuntime, request: GatewayRequest): Promise<Response> => {
  const result = await runtime.gateway.run(request);
  return result.ok ? jsonResponse(200, { ok: true, result: result.value }) : errorResponse(400, result.error);
};

const readSearchString = (url: URL, key: string): string | undefined => url.searchParams.get(key) ?? undefined;

const readUsagePeriod = (url: URL): UsageHttpPeriod | PlatformError => {
  const value = readSearchString(url, "period") ?? "month";
  return value === "today" || value === "month" || value === "year" || value === "all"
    ? value
    : platformError("HTTP_INVALID_QUERY", "Query parameter 'period' must be today, month, year, or all.");
};

const authorizeScopedRead = async (
  request: Request,
  url: URL,
  options: PlatformHttpHandlerOptions,
  requiredScope: readonly ("workspaceId" | "userId")[] = []
): Promise<ScopedAuthorizationRequest | Response> => {
  if (options.authorizeScopedRequest === undefined && options.authorizeUsageRequest === undefined) {
    return errorResponse(404, platformError("HTTP_NOT_FOUND", `Route '${url.pathname}' was not found.`));
  }
  const client = readSearchString(url, "client");
  if (client === undefined) {
    return errorResponse(400, platformError("HTTP_INVALID_QUERY", "Query parameter 'client' is required."));
  }
  const workspaceId = readSearchString(url, "workspaceId");
  const userId = readSearchString(url, "userId");
  const ownerUserId = readSearchString(url, "ownerUserId");
  const scope: ScopedAuthorizationRequest = {
    clientId: client,
    ...(workspaceId === undefined ? {} : { workspaceId }),
    ...(userId === undefined ? {} : { userId }),
    ...(ownerUserId === undefined ? {} : { ownerUserId })
  };
  for (const key of requiredScope) {
    if (scope[key] === undefined) {
      return errorResponse(400, platformError(
        "HTTP_INVALID_QUERY",
        `Query parameter '${key}' is required for scoped reads.`
      ));
    }
  }
  const authorized = options.authorizeScopedRequest === undefined
    ? await options.authorizeUsageRequest?.(request, client)
    : await options.authorizeScopedRequest(request, scope);
  if (authorized !== true) {
    return errorResponse(403, platformError(
      "AUTHORIZATION_SCOPE_VIOLATION",
      "Request scope must match the authenticated client, workspace, and user."
    ));
  }
  return scope;
};

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfYear = (date: Date): Date => new Date(date.getFullYear(), 0, 1);

const filterByPeriod = <T extends { readonly occurredAt: Date }>(
  records: readonly T[],
  period: UsageHttpPeriod,
  now: Date
): readonly T[] => {
  if (period === "all") return records;
  const start = period === "today" ? startOfDay(now) : period === "month" ? startOfMonth(now) : startOfYear(now);
  return records.filter((record) => record.occurredAt.getTime() >= start.getTime() && record.occurredAt.getTime() <= now.getTime());
};

const addBreakdownRecord = (
  source: Readonly<Record<string, UsageHttpBreakdownItem>>,
  key: string,
  record: { readonly totalTokens: number; readonly costAmount: number }
): Readonly<Record<string, UsageHttpBreakdownItem>> => {
  const current = source[key] ?? { usageCount: 0, totalTokens: 0, totalCost: 0 };
  return {
    ...source,
    [key]: {
      usageCount: current.usageCount + 1,
      totalTokens: current.totalTokens + record.totalTokens,
      totalCost: current.totalCost + record.costAmount
    }
  };
};

const listUsage = async (
  runtime: PlatformRuntime,
  request: Request,
  url: URL,
  options: PlatformHttpHandlerOptions
): Promise<Response> => {
  const scopedRead = await authorizeScopedRead(request, url, options, ["workspaceId", "userId"]);
  if (scopedRead instanceof Response) return scopedRead;
  const { clientId: client } = scopedRead;
  const workspaceId = scopedRead.workspaceId;
  const userId = scopedRead.userId;
  if (workspaceId === undefined || userId === undefined) {
    return errorResponse(400, platformError("HTTP_INVALID_QUERY", "Query parameters 'workspaceId' and 'userId' are required."));
  }
  const period = readUsagePeriod(url);
  if (isPlatformError(period)) return errorResponse(400, period);
  const usage = await runtime.analytics.listUsage();
  if (!usage.ok) return errorResponse(400, usage.error);
  const capability = readSearchString(url, "capability");
  const provider = readSearchString(url, "provider");
  const model = readSearchString(url, "model");
  const now = new Date();
  const records = filterByPeriod(usage.value, period, now).filter((record) =>
    record.client === client &&
    record.workspaceId === workspaceId &&
    record.userId === userId &&
    (capability === undefined || record.capability === capability) &&
    (provider === undefined || record.provider === provider) &&
    (model === undefined || record.model === model)
  );
  return jsonResponse(200, {
    ok: true,
    summary: {
      client,
      workspaceId,
      userId,
      period,
      usageCount: records.length,
      totalTokens: records.reduce((sum, record) => sum + record.totalTokens, 0),
      totalCost: records.reduce((sum, record) => sum + record.costAmount, 0),
      byCapability: records.reduce((acc, record) => addBreakdownRecord(acc, record.capability, record), {}),
      byWorkflow: records.reduce((acc, record) => (
        record.workflow === undefined ? acc : addBreakdownRecord(acc, record.workflow, record)
      ), {}),
      byProvider: records.reduce((acc, record) => addBreakdownRecord(acc, record.provider, record), {}),
      byModel: records.reduce((acc, record) => addBreakdownRecord(acc, record.model, record), {})
    }
  });
};

const getDashboardUsage = async (
  runtime: PlatformRuntime,
  request: Request,
  url: URL,
  options: PlatformHttpHandlerOptions
): Promise<Response> => {
  const scopedRead = await authorizeScopedRead(request, url, options, ["workspaceId", "userId"]);
  if (scopedRead instanceof Response) return scopedRead;
  const workspaceId = scopedRead.workspaceId;
  const userId = scopedRead.userId;
  if (workspaceId === undefined || userId === undefined) {
    return errorResponse(400, platformError("HTTP_INVALID_QUERY", "Query parameters 'workspaceId' and 'userId' are required."));
  }
  const period = readUsagePeriod(url);
  if (isPlatformError(period)) return errorResponse(400, period);
  const view = await runtime.dashboard.getView({
    client: scopedRead.clientId,
    period,
    workspaceId,
    userId
  });
  return view.ok ? jsonResponse(200, { ok: true, view: view.value }) : errorResponse(400, view.error);
};

const toCapabilityHttpView = (capability: CapabilityRegisterHttpBody): CapabilityHttpView => ({
  id: capability.id,
  name: capability.name,
  description: capability.description,
  permission: capability.permission,
  input: capability.input,
  output: capability.output
});

const registerCapability = async (
  runtime: PlatformRuntime,
  request: Request,
  url: URL,
  options: PlatformHttpHandlerOptions
): Promise<Response> => {
  const scopedRead = await authorizeScopedRead(request, url, options);
  if (scopedRead instanceof Response) return scopedRead;
  const parsed = parseCapabilityRegisterBody(await request.json().catch(() => undefined));
  if (isPlatformError(parsed)) return errorResponse(400, parsed);
  const registered = runtime.registry.register({
    ...parsed,
    execute: async () => err(platformError(
      "CAPABILITY_HTTP_MANIFEST_ONLY",
      `Capability '${parsed.id}' was registered as an HTTP manifest and has no local executor.`
    ))
  });
  if (!registered.ok) return errorResponse(400, registered.error);
  return jsonResponse(201, { ok: true, capability: toCapabilityHttpView(parsed) });
};

const renderPromptTemplate = async (
  runtime: PlatformRuntime,
  request: Request,
  url: URL,
  options: PlatformHttpHandlerOptions
): Promise<Response> => {
  const scopedRead = await authorizeScopedRead(request, url, options);
  if (scopedRead instanceof Response) return scopedRead;
  const parsed = parsePromptTemplateRenderBody(await request.json().catch(() => undefined));
  if (isPlatformError(parsed)) return errorResponse(400, parsed);
  const rendered = await runtime.prompt.render(parsed);
  return rendered.ok
    ? jsonResponse(200, { ok: true, prompt: rendered.value })
    : errorResponse(400, rendered.error);
};

const createPromptTemplate = async (
  runtime: PlatformRuntime,
  request: Request,
  url: URL,
  options: PlatformHttpHandlerOptions
): Promise<Response> => {
  const scopedRead = await authorizeScopedRead(request, url, options);
  if (scopedRead instanceof Response) return scopedRead;
  const parsed = parsePromptTemplateCreateBody(await request.json().catch(() => undefined));
  if (isPlatformError(parsed)) return errorResponse(400, parsed);
  const saved = await runtime.prompt.register(parsed);
  return saved.ok
    ? jsonResponse(201, { ok: true, promptTemplate: saved.value })
    : errorResponse(400, saved.error);
};

const toActivityHttpView = (activity: Activity): ActivityHttpView => ({
  id: activity.id.value,
  client: activity.request.client,
  ...(activity.request.workspaceId === undefined ? {} : { workspaceId: activity.request.workspaceId }),
  ...(activity.request.userId === undefined ? {} : { userId: activity.request.userId }),
  ...(activity.request.ownerUserId === undefined ? {} : { ownerUserId: activity.request.ownerUserId }),
  capability: activity.request.capability,
  ...(activity.request.workflow === undefined ? {} : { workflow: activity.request.workflow }),
  status: activity.status,
  ...(activity.result?.provider === undefined ? {} : { provider: activity.result.provider }),
  ...(activity.result?.model === undefined ? {} : { model: activity.result.model }),
  ...(activity.result?.tokens === undefined ? {} : { tokens: activity.result.tokens }),
  ...(activity.result?.cost === undefined ? {} : { cost: activity.result.cost }),
  ...(activity.result?.latencyMs === undefined ? {} : { latencyMs: activity.result.latencyMs }),
  ...(activity.result?.knowledgeUsed === undefined ? {} : { knowledgeUsed: activity.result.knowledgeUsed }),
  createdAt: activity.createdAt.toISOString(),
  updatedAt: activity.updatedAt.toISOString()
});

const getActivity = async (
  runtime: PlatformRuntime,
  request: Request,
  url: URL,
  options: PlatformHttpHandlerOptions,
  activityRoutePrefix: string
): Promise<Response> => {
  const scopedRead = await authorizeScopedRead(request, url, options, ["workspaceId", "userId"]);
  if (scopedRead instanceof Response) return scopedRead;
  const workspaceId = scopedRead.workspaceId;
  const userId = scopedRead.userId;
  if (workspaceId === undefined || userId === undefined) {
    return errorResponse(400, platformError("HTTP_INVALID_QUERY", "Query parameters 'workspaceId' and 'userId' are required."));
  }
  const activityId = url.pathname.slice(activityRoutePrefix.length + 1);
  if (activityId.length === 0 || activityId.includes("/")) {
    return errorResponse(404, platformError("HTTP_NOT_FOUND", `Route '${url.pathname}' was not found.`));
  }
  const activity = await runtime.activity.get(activityId);
  if (!activity.ok) return errorResponse(404, activity.error);
  if (activity.value.request.client !== scopedRead.clientId) {
    return errorResponse(403, platformError("AUTHORIZATION_SCOPE_VIOLATION", "Activity reads must be scoped to the caller."));
  }
  if (
    activity.value.request.workspaceId !== workspaceId ||
    activity.value.request.userId !== userId
  ) {
    return errorResponse(404, platformError("ACTIVITY_NOT_FOUND", `Activity '${activityId}' was not found.`));
  }
  return jsonResponse(200, { ok: true, activity: toActivityHttpView(activity.value) });
};

const readScopedActivity = async (
  runtime: PlatformRuntime,
  request: Request,
  url: URL,
  options: PlatformHttpHandlerOptions,
  activityId: string
): Promise<Activity | Response> => {
  const scopedRead = await authorizeScopedRead(request, url, options, ["workspaceId", "userId"]);
  if (scopedRead instanceof Response) return scopedRead;
  const workspaceId = scopedRead.workspaceId;
  const userId = scopedRead.userId;
  if (workspaceId === undefined || userId === undefined) {
    return errorResponse(400, platformError("HTTP_INVALID_QUERY", "Query parameters 'workspaceId' and 'userId' are required."));
  }
  const activity = await runtime.activity.get(activityId);
  if (!activity.ok) return errorResponse(404, activity.error);
  if (activity.value.request.client !== scopedRead.clientId) {
    return errorResponse(403, platformError("AUTHORIZATION_SCOPE_VIOLATION", "Activity writes must be scoped to the caller."));
  }
  if (
    activity.value.request.workspaceId !== workspaceId ||
    activity.value.request.userId !== userId
  ) {
    return errorResponse(404, platformError("ACTIVITY_NOT_FOUND", `Activity '${activityId}' was not found.`));
  }
  return activity.value;
};

const recordActivityOutcome = async (
  runtime: PlatformRuntime,
  request: Request,
  url: URL,
  options: PlatformHttpHandlerOptions,
  activityId: string
): Promise<Response> => {
  const activity = await readScopedActivity(runtime, request, url, options, activityId);
  if (activity instanceof Response) return activity;
  const parsed = parseActivityOutcomeBody(activityId, await request.json().catch(() => undefined));
  if (isPlatformError(parsed)) return errorResponse(400, parsed);
  const recorded = await runtime.gateway.recordOutcome({
    auth: { clientId: activity.request.client, permissions: [] },
    outcome: parsed
  });
  return recorded.ok
    ? jsonResponse(201, { ok: true, activityId, outcome: parsed })
    : errorResponse(400, recorded.error);
};

const recordActivityFeedback = async (
  runtime: PlatformRuntime,
  request: Request,
  url: URL,
  options: PlatformHttpHandlerOptions,
  activityId: string
): Promise<Response> => {
  const activity = await readScopedActivity(runtime, request, url, options, activityId);
  if (activity instanceof Response) return activity;
  const parsed = parseActivityFeedbackBody(activityId, await request.json().catch(() => undefined));
  if (isPlatformError(parsed)) return errorResponse(400, parsed);
  const recorded = await runtime.gateway.recordFeedback({
    auth: { clientId: activity.request.client, permissions: [] },
    feedback: parsed
  });
  return recorded.ok
    ? jsonResponse(201, { ok: true, activityId, feedback: parsed })
    : errorResponse(400, recorded.error);
};

const appName = "ai-platform-core" as const;
const appVersion = "0.1.0";
const contractVersion = "0.1.0";
const identityMode = "workspaceId+userId" as const;

const getHealth = (runtime: PlatformRuntime): Response => {
  const health: PlatformHealthView = {
    appName,
    status: "ok",
    timestamp: runtime.clock.now().toISOString()
  };
  return jsonResponse(200, health);
};

const getVersion = (runtime: PlatformRuntime): Response => {
  const commitSha = readStringFromEnvironment("COMMIT_SHA") ?? readStringFromEnvironment("VERCEL_GIT_COMMIT_SHA");
  const version: PlatformVersionView = {
    appName,
    appVersion,
    contractVersion,
    ...(commitSha === undefined ? {} : { commitSha }),
    timestamp: runtime.clock.now().toISOString()
  };
  return jsonResponse(200, version);
};

const readStringFromEnvironment = (key: string): string | undefined => {
  const value = process.env[key];
  return value === undefined || value.length === 0 ? undefined : value;
};

const getContractStatus = (runtime: PlatformRuntime): Response => {
  const issues: string[] = [];
  const usesLegacyEventNames = false;
  const usesReportTerminology = true;
  const canonicalOwnershipChecked = true;
  const statusValue: PlatformContractStatusView["status"] = issues.length === 0 ? "ok" : "warning";
  const status: PlatformContractStatusView = {
    appName,
    status: statusValue,
    contractVersion,
    identityMode,
    professionalIdRequired: false,
    usesLegacyEventNames,
    usesReportTerminology,
    canonicalOwnershipChecked,
    authenticationContract: {
      status: "mvp_scoped_headers",
      identityMode,
      requiredReadScope: ["clientId", "workspaceId", "userId"],
      professionalIdRequired: false
    },
    issues,
    timestamp: runtime.clock.now().toISOString()
  };
  return jsonResponse(200, status);
};

export const createGatewayHttpHandler = (
  runtime: PlatformRuntime,
  options: GatewayHttpHandlerOptions = {}
): ((request: Request) => Promise<Response>) => {
  const route = options.route ?? "/v1/gateway/run";
  return async (request) => {
    const url = new URL(request.url);
    if (url.pathname !== route) {
      return errorResponse(404, platformError("HTTP_NOT_FOUND", `Route '${url.pathname}' was not found.`));
    }
    if (request.method !== "POST") {
      return errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only POST is supported."));
    }

    const parsed = parseGatewayRunBody(await request.json().catch(() => undefined));
    if ("code" in parsed) return errorResponse(400, parsed);
    return runGateway(runtime, parsed);
  };
};

export const createPlatformHttpHandler = (
  runtime: PlatformRuntime,
  options: PlatformHttpHandlerOptions = {}
): ((request: Request) => Promise<Response>) => {
  const gatewayRunRoute = options.gatewayRunRoute ?? "/v1/gateway/run";
  const analyticsUsageRoute = options.analyticsUsageRoute ?? "/v1/analytics/usage";
  const dashboardUsageRoute = options.dashboardUsageRoute ?? "/v1/dashboard/usage";
  const healthRoute = options.healthRoute ?? "/health";
  const versionRoute = options.versionRoute ?? "/version";
  const contractStatusRoute = options.contractStatusRoute ?? "/contracts/status";
  const activityRoutePrefix = options.activityRoutePrefix ?? "/v1/activities";
  const capabilityRegisterRoute = options.capabilityRegisterRoute ?? "/v1/capabilities";
  const promptTemplateRenderRoute = options.promptTemplateRenderRoute ?? "/v1/prompt-templates/render";
  return async (request) => {
    const url = new URL(request.url);
    if (url.pathname === healthRoute || url.pathname === "/v1/health") {
      return request.method === "GET"
        ? getHealth(runtime)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only GET is supported."));
    }
    if (url.pathname === versionRoute || url.pathname === "/v1/version") {
      return request.method === "GET"
        ? getVersion(runtime)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only GET is supported."));
    }
    if (url.pathname === contractStatusRoute || url.pathname === "/v1/contracts/status") {
      return request.method === "GET"
        ? getContractStatus(runtime)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only GET is supported."));
    }
    if (url.pathname === gatewayRunRoute) {
      return createGatewayHttpHandler(runtime, { route: gatewayRunRoute })(request);
    }
    if (url.pathname === analyticsUsageRoute) {
      return request.method === "GET"
        ? listUsage(runtime, request, url, options)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only GET is supported."));
    }
    if (url.pathname === dashboardUsageRoute) {
      return request.method === "GET"
        ? getDashboardUsage(runtime, request, url, options)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only GET is supported."));
    }
    if (url.pathname === capabilityRegisterRoute) {
      return request.method === "POST"
        ? registerCapability(runtime, request, url, options)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only POST is supported."));
    }
    if (url.pathname === "/v1/prompt-templates") {
      return request.method === "POST"
        ? createPromptTemplate(runtime, request, url, options)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only POST is supported."));
    }
    if (url.pathname === promptTemplateRenderRoute) {
      return request.method === "POST"
        ? renderPromptTemplate(runtime, request, url, options)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only POST is supported."));
    }
    if (url.pathname.startsWith(`${activityRoutePrefix}/`) && url.pathname.endsWith("/outcome")) {
      const activityId = url.pathname.slice(activityRoutePrefix.length + 1, -"/outcome".length);
      return request.method === "POST" && activityId.length > 0 && !activityId.includes("/")
        ? recordActivityOutcome(runtime, request, url, options, activityId)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only POST is supported."));
    }
    if (url.pathname.startsWith(`${activityRoutePrefix}/`) && url.pathname.endsWith("/feedback")) {
      const activityId = url.pathname.slice(activityRoutePrefix.length + 1, -"/feedback".length);
      return request.method === "POST" && activityId.length > 0 && !activityId.includes("/")
        ? recordActivityFeedback(runtime, request, url, options, activityId)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only POST is supported."));
    }
    if (url.pathname.startsWith(`${activityRoutePrefix}/`)) {
      return request.method === "GET"
        ? getActivity(runtime, request, url, options, activityRoutePrefix)
        : errorResponse(405, platformError("HTTP_METHOD_NOT_ALLOWED", "Only GET is supported."));
    }
    return errorResponse(404, platformError("HTTP_NOT_FOUND", `Route '${url.pathname}' was not found.`));
  };
};
