import type { D1DatabaseLike } from "@ai-platform-core/storage";
import { describe, expect, it } from "vitest";
import { enforceGatewayPlan, readGatewayPlanContext } from "./gateway-plan-guard.js";

const db = {} as D1DatabaseLike;

const gatewayRequest = (appId: string, headers: Record<string, string> = {}, capability = "studio.report.ai_assist") =>
  new Request("https://example.test/v1/gateway/run", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({
      auth: { clientId: appId, permissions: [] },
      activity: {
        client: appId,
        workspaceId: "ws-1",
        userId: "user-1",
        capability,
        goal: "test",
        context: {},
        input: {},
      },
      messages: [{ role: "user", content: "hello" }],
    }),
  });

const managedRequest = (headers: Record<string, string> = {}, capability = "studio.report.ai_assist") =>
  gatewayRequest(
    "numeria-studio",
    {
      "x-source-app": "numeria-studio",
      "x-client-id": "numeria-studio",
      "x-plan-id": "free",
      "x-feature-key": capability,
      "x-activity-id": "activity-1",
      "x-workspace-id": "ws-1",
      "x-user-id": "user-1",
      ...headers,
    },
    capability,
  );

describe("gateway plan guard", () => {
  it("requires plan context for Numeria Studio", async () => {
    await expect(readGatewayPlanContext(gatewayRequest("numeria-studio"))).rejects.toThrow(
      "PLAN_GATEWAY_CONTEXT_REQUIRED",
    );
  });

  it("reads plan context for managed requests", async () => {
    const context = await readGatewayPlanContext(
      gatewayRequest("numeria-studio", {
        "x-plan-id": "free",
        "x-feature-key": "studio.report.ai_assist",
        "x-activity-id": "activity-1",
        "x-workspace-id": "ws-1",
        "x-user-id": "user-1",
        "x-trace-id": "trace-1",
        "x-correlation-id": "corr-1",
      }),
    );
    expect(context).toMatchObject({
      appId: "numeria-studio",
      workspaceId: "ws-1",
      userId: "user-1",
      planId: "free",
      featureKey: "studio.report.ai_assist",
      activityId: "activity-1",
      traceId: "trace-1",
      correlationId: "corr-1",
    });
  });

  it("keeps legacy production e2e clients unmanaged", async () => {
    await expect(readGatewayPlanContext(gatewayRequest("production-e2e"))).resolves.toBeNull();
  });

  it("rejects x-source-app that does not match the managed body client", async () => {
    const result = await enforceGatewayPlan(
      managedRequest({ "x-source-app": "velvet", "x-client-id": "velvet" }),
      db,
    );

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ errorCode: "AUTHORIZATION_SCOPE_VIOLATION" });
  });

  it("rejects x-client-id that does not match the managed app", async () => {
    const result = await enforceGatewayPlan(managedRequest({ "x-client-id": "velvet" }), db);

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ errorCode: "AUTHORIZATION_SCOPE_VIOLATION" });
  });

  it("rejects x-feature-key that does not match the body capability", async () => {
    const result = await enforceGatewayPlan(
      managedRequest({ "x-feature-key": "studio.report.generate" }),
      db,
    );

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ errorCode: "AUTHORIZATION_SCOPE_VIOLATION" });
  });

  it("rejects workspace scope mismatch before touching usage storage", async () => {
    const result = await enforceGatewayPlan(managedRequest({ "x-workspace-id": "ws-other" }), db);

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ errorCode: "AUTHORIZATION_SCOPE_VIOLATION" });
  });
});
