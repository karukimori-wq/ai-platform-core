import baseWorker from "./index.js";
import { handleEntitlementRead, handleUsageConsume, handleUsageRead } from "./plan-api.js";
import { commitGatewayPlanUsage, enforceGatewayPlan } from "./gateway-plan-guard.js";
import type { D1DatabaseLike } from "@ai-platform-core/storage";

interface Env {
  DB: D1DatabaseLike;
  COMMIT_SHA?: string;
  OPENAI_API_KEY?: string;
  OPENAI_DEFAULT_MODEL?: string;
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers":
    "content-type,authorization,x-client-id,x-workspace-id,x-user-id,x-trace-id,x-correlation-id,x-source-app,x-plan-id,x-feature-key,x-activity-id",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

const shouldCommitGatewayUsage = (response: Response): boolean => response.ok;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);

    if ((pathname === "/v1/usage" || pathname === "/api/usage") && request.method === "GET") {
      const result = await handleUsageRead(request, env.DB);
      return json(result.body, result.status);
    }

    if (
      (pathname === "/v1/entitlements" || pathname === "/api/entitlements") &&
      request.method === "GET"
    ) {
      const result = await handleEntitlementRead(request, env.DB);
      return json(result.body, result.status);
    }

    if (
      (pathname === "/v1/usage/consume" || pathname === "/api/usage/consume") &&
      request.method === "POST"
    ) {
      const result = await handleUsageConsume(request, env.DB);
      return json(result.body, result.status);
    }

    if (pathname === "/v1/gateway/run" && request.method === "POST") {
      const gate = await enforceGatewayPlan(request, env.DB);
      if (!gate.allowed) return json(gate.body, gate.status);

      const response = await baseWorker.fetch(request, env);
      if (gate.context !== undefined && shouldCommitGatewayUsage(response)) {
        await commitGatewayPlanUsage(env.DB, gate.context);
      }
      return response;
    }

    return baseWorker.fetch(request, env);
  },
};
