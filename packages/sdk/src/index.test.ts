import { describe, expect, it } from "vitest";
import { Email, createPlatform, createPlatformRuntime, ok } from "./index.js";

describe("sdk", () => {
  it("exports public API", () => {
    expect(Email.create("user@example.com").ok).toBe(true);
    expect(createPlatformRuntime().clock.now()).toBeInstanceOf(Date);
  });

  it("runs capabilities through the composed platform", async () => {
    const platform = createPlatform();
    platform.registry.register({
      id: "Text.Reverse",
      name: "Reverse text",
      description: "Reverses text.",
      permission: "text.reverse",
      input: "string",
      output: "string",
      execute: async (input: string) => ok([...input].reverse().join(""))
    });
    const result = await platform.capability.execute<string, string>("Text.Reverse", "core", {
      actorId: "user",
      permissions: ["text.reverse"],
      metadata: {}
    });
    expect(result).toEqual({ ok: true, value: "eroc" });
  });
});
