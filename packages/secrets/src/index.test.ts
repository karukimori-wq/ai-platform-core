import { describe, expect, it } from "vitest";
import { createEnvironmentSecretReader, createMemorySecretStore, createSecretReader } from "./index";

describe("secret stores", () => {
  it("stores and reads memory secrets", async () => {
    const store = createMemorySecretStore();
    const reader = createSecretReader(store);

    const saved = await store.set("OPENAI_API_KEY", "secret-value");
    const read = await reader.get("OPENAI_API_KEY");

    expect(saved.ok).toBe(true);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toBe("secret-value");
  });

  it("reads environment secrets", async () => {
    const reader = createEnvironmentSecretReader({ OPENAI_API_KEY: "env-secret" });
    const read = await reader.get("OPENAI_API_KEY");

    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toBe("env-secret");
  });
});
