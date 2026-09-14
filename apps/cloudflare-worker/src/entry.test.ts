import type { D1DatabaseLike } from "@ai-platform-core/storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./entry.js";

const db = {} as D1DatabaseLike;

const providerRequest = (): Request => new Request("https://example.com/v1/providers/status");
const releaseRequest = (): Request => new Request("https://example.com/release/status");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Cloudflare provider readiness", () => {
  it("reports OpenAI configured without exposing the secret", async () => {
    const response = await worker.fetch(providerRequest(), {
      DB: db,
      OPENAI_API_KEY: "super-secret-provider-key",
      OPENAI_DEFAULT_MODEL: "configured-model",
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    const body = JSON.parse(text) as {
      status: string;
      providers: { openai: { configured: boolean; api: string; modelSource: string; managedApps: string[] } };
      secretValuesExposed: boolean;
    };

    expect(body.status).toBe("success");
    expect(body.providers.openai.configured).toBe(true);
    expect(body.providers.openai.api).toBe("responses");
    expect(body.providers.openai.modelSource).toBe("environment");
    expect(body.providers.openai.managedApps).toEqual(["numeria-studio", "velvet"]);
    expect(body.secretValuesExposed).toBe(false);
    expect(text).not.toContain("super-secret-provider-key");
  });

  it("reports a warning when OpenAI is not configured", async () => {
    const response = await worker.fetch(providerRequest(), { DB: db });
    const body = (await response.json()) as {
      status: string;
      providers: { openai: { configured: boolean; modelSource: string } };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("warning");
    expect(body.providers.openai.configured).toBe(false);
    expect(body.providers.openai.modelSource).toBe("repository_default");
  });
});

describe("Free Pro release status", () => {
  it("reports Free and Pro ready while Business remains unavailable", async () => {
    const response = await worker.fetch(releaseRequest(), {
      DB: db,
      COMMIT_SHA: "release-sha",
      OPENAI_API_KEY: "provider-secret",
    });
    const text = await response.text();
    const body = JSON.parse(text) as {
      appId: string;
      appVersion: string;
      releaseScope: string[];
      releaseStatus: string;
      plans: {
        free: { releaseStatus: string; entitlementReady: boolean; usageReady: boolean };
        pro: { releaseStatus: string; entitlementReady: boolean; usageReady: boolean };
        business: { releaseStatus: string; purchasable: boolean; entitlementReady: boolean; usageReady: boolean };
      };
      readiness: { provider: boolean; entitlement: boolean; usage: boolean; idempotency: boolean };
      professionalIdRequired: boolean;
      notSourceOfTruth: string[];
    };

    expect(response.status).toBe(200);
    expect(body.appId).toBe("ai-platform-core");
    expect(body.appVersion).toBe("release-sha");
    expect(body.releaseScope).toEqual(["free", "pro"]);
    expect(body.releaseStatus).toBe("ready");
    expect(body.plans.free).toMatchObject({ releaseStatus: "ready", entitlementReady: true, usageReady: true });
    expect(body.plans.pro).toMatchObject({ releaseStatus: "ready", entitlementReady: true, usageReady: true });
    expect(body.plans.business).toEqual({
      releaseStatus: "unavailable",
      purchasable: false,
      entitlementReady: false,
      usageReady: false,
    });
    expect(body.readiness).toMatchObject({ provider: true, entitlement: true, usage: true, idempotency: true });
    expect(body.professionalIdRequired).toBe(false);
    expect(body.notSourceOfTruth).toEqual(expect.arrayContaining(["Subscription", "Payment", "Customer", "Reservation", "Sales"]));
    expect(text).not.toContain("provider-secret");
  });

  it("uses the process COMMIT_SHA when the Worker binding is unavailable", async () => {
    vi.stubEnv("COMMIT_SHA", "process-release-sha");

    const response = await worker.fetch(releaseRequest(), {
      DB: db,
      OPENAI_API_KEY: "provider-secret",
    });
    const body = (await response.json()) as { appVersion: string };

    expect(body.appVersion).toBe("process-release-sha");
  });

  it("reports release blocked when the managed OpenAI provider is missing", async () => {
    const response = await worker.fetch(releaseRequest(), { DB: db });
    const body = (await response.json()) as { releaseStatus: string; readiness: { provider: boolean } };

    expect(response.status).toBe(200);
    expect(body.releaseStatus).toBe("blocked");
    expect(body.readiness.provider).toBe(false);
  });
});
