import type { D1DatabaseLike } from "@ai-platform-core/storage";
import { describe, expect, it } from "vitest";
import worker from "./entry.js";

const db = {} as D1DatabaseLike;

const request = (): Request => new Request("https://example.com/v1/providers/status");

describe("Cloudflare provider readiness", () => {
  it("reports OpenAI configured without exposing the secret", async () => {
    const response = await worker.fetch(request(), {
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
    const response = await worker.fetch(request(), { DB: db });
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
