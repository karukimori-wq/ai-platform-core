import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Cloudflare Worker contracts", () => {
  it("binds the platform HTTP handler to the D1 runtime", () => {
    const source = read("./index.ts");
    expect(source).toContain("createCloudflarePlatformRuntime");
    expect(source).toContain("createPlatformHttpHandler");
    expect(source).toContain("db:env.DB");
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
    expect(source).toContain('request.method==="OPTIONS"');
    expect(source).toContain("access-control-allow-origin");
    expect(source).toContain("x-client-id");
    expect(source).toContain("x-workspace-id");
    expect(source).toContain("x-user-id");
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
    expect(source).toContain("velvet.message_draft.generate");
    expect(source).toContain("MessageDraft");
    expect(source).toContain("fullMeetingTranscript");
    expect(source).toContain("paymentStatus");
    expect(source).toContain("AI Activity");
    expect(source).toContain("AI Usage");
    expect(source).toContain("AI Capability");
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
});
