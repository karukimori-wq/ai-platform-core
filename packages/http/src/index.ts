import type { ActivityBudget, ActivityRequest } from "@ai-platform-core/activity";
import type { GatewayAuthContext, GatewayRequest } from "@ai-platform-core/gateway";
import { type PlatformError, platformError } from "@ai-platform-core/kernel";
import type { AIMessage } from "@ai-platform-core/provider";
import type { PlatformRuntime } from "@ai-platform-core/runtime";

export interface GatewayHttpHandlerOptions {
  readonly route?: string;
}

export interface GatewayRunHttpBody {
  readonly auth: GatewayAuthContext;
  readonly activity: ActivityRequest;
  readonly messages: readonly AIMessage[];
}

const jsonHeaders = { "content-type": "application/json" };

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const errorResponse = (status: number, error: PlatformError): Response =>
  jsonResponse(status, { ok: false, error });

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
  const budget = readBudget(activity, "budget");
  const provider = readString(activity, "provider");
  const model = readString(activity, "model");
  const activityRequest: ActivityRequest = {
    client,
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

const runGateway = async (runtime: PlatformRuntime, request: GatewayRequest): Promise<Response> => {
  const result = await runtime.gateway.run(request);
  return result.ok ? jsonResponse(200, { ok: true, result: result.value }) : errorResponse(400, result.error);
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
