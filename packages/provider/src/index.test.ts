import { describe, expect, it } from "vitest";
import { createEchoProvider, createProviderRegistry } from "./index";

describe("provider registry", () => {
  it("registers and resolves providers", async () => {
    const registry = createProviderRegistry();
    registry.register(createEchoProvider());
    const provider = registry.get("echo");
    expect(provider.ok).toBe(true);
    if (!provider.ok) return;
    const response = await provider.value.chat({
      model: "test",
      messages: [{ role: "user", content: "hello" }]
    });
    expect(response.ok).toBe(true);
  });
});
