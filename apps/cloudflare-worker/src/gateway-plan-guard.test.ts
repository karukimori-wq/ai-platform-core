import { describe, expect, it } from "vitest";
import { readGatewayPlanContext } from "./gateway-plan-guard.js";

const gatewayRequest = (appId: string, headers: Record<string, string> = {}) =>
  new Request("https://example.test/v1/gateway/run", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({
      auth: { clientId: appId, permissions: [] },
      activity: {
        client: appId,
        workspaceId: "ws-1",
        userId: "user-1",
        capability: "studio.report.ai_assist",
        goal: "test",
        context: {},
        input: {},
      },
      messages: [{ role: "user", content: "hello" }],
    }),
  });

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
});
