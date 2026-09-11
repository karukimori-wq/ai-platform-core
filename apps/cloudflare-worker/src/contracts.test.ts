import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Cloudflare Worker contracts", () => {
  it("binds the platform HTTP handler to the D1 runtime", () => {
    const source = read("./index.ts");
    expect(source).toContain("createCloudflarePlatformRuntime");
    expect(source).toContain("createPlatformHttpHandler");
    expect(source).toMatch(/db:\s*env\.DB/);
  });

  it("exposes D1 readiness and roundtrip probes", () => {
    const source = read("./index.ts");
    expect(source).toContain("/api/persistence/status");
    expect(source).toContain("/api/persistence/roundtrip");
    expect(source).toContain("system.roundtrip");
    expect(source).toContain("roundtripReady");
  });

  it("keeps browser monitoring compatible through CORS", () => {
    const source = read("./index.ts");
    expect(source).toMatch(/request\.method\s*===\s*["']OPTIONS["']/);
    expect(source).toContain("access-control-allow-origin");
    expect(source).toContain("x-client-id");
    expect(source).toContain("x-workspace-id");
    expect(source).toContain("x-user-id");
    expect(source).toContain("x-plan-id");
    expect(source).toContain("x-feature-key");
    expect(source).toContain("x-activity-id");
  });

  it("exposes MVP scoped authentication status and checks scope headers", () => {
    const source = read("./index.ts");
    expect(source).toContain("/api/auth/status");
    expect(source).toContain("authorizeScopedRequest");
    expect(source).toContain("ScopedAuthorizationRequest");
    expect(source).toContain("mvp_scoped_headers");
  });

  it("exposes application integration boundary status", () => {
    const source = read("./index.ts");
    expect(source).toContain("/v1/integrations/status");
    expect(source).toContain("/api/integrations/status");
    expect(source).toContain("communication.reply.generate");
    expect(source).toContain("studio.report.ai_assist");
    expect(source).toContain("velvet.memory.summary");
    expect(source).toContain("velvet.memory.search");
    expect(source).toContain("velvet.memory.recall");
    expect(source).toContain("MessageDraft");
    expect(source).toContain("fullMeetingTranscript");
    expect(source).toContain("paymentStatus");
    expect(source).toContain("AI Activity");
    expect(source).toContain("AI Usage");
    expect(source).toContain("AI Capability");
  });

  it("exposes plan gateway status for Platform Admin", () => {
    const source = read("./index.ts");
    expect(source).toContain("planGateway");
    expect(source).toContain("managedApps");
    expect(source).toContain("numeria-studio");
    expect(source).toContain("velvet");
    expect(source).toContain("post_success_gateway_response");
    expect(source).toContain("failedProviderCallsConsumePlanUsage");
    expect(source).toContain("appId|workspaceId|userId|activityId");
    expect(source).toContain("/v1/usage");
    expect(source).toContain("/v1/entitlements");
    expect(source).toContain("/v1/usage/consume");
  });

  it("exposes provider readiness without exposing provider secrets", () => {
    const source = read("./entry.ts");
    expect(source).toContain("/v1/providers/status");
    expect(source).toContain("/api/providers/status");
    expect(source).toContain("openAIConfigured");
    expect(source).toContain('api: "responses"');
    expect(source).toContain('managedApps: ["numeria-studio", "velvet"]');
    expect(source).toContain("secretValuesExposed: false");
    expect(source).toContain("repository_default");
  });

  it("exposes an aggregate production readiness view", () => {
    const source = read("./index.ts");
    expect(source).toContain("/v1/readiness");
    expect(source).toContain("/api/readiness");
    expect(source).toContain("productionReady");
    expect(source).toContain("eventStore");
    expect(source).toContain("integrationBoundary");
    expect(source).toContain("commitSha");
  });

  it("returns actionable readiness diagnostics for operators", () => {
    const source = read("./index.ts");
    expect(source).toContain("failedChecks");
    expect(source).toContain("recommendedActions");
    expect(source).toContain("Check /api/persistence/status");
    expect(source).toContain("Check /v1/events/status");
    expect(source).toContain("Check /v1/integrations/status");
  });
});
