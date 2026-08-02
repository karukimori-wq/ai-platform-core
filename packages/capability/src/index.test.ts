import { describe, expect, it } from "vitest";
import { ok } from "@ai-platform-core/kernel";
import { createCapabilityRegistry, createCapabilityRuntime, createPermissionChecker } from "./index.js";

describe("capability", () => {
  it("executes registered capabilities with permission", async () => {
    const registry = createCapabilityRegistry();
    registry.register({ id: "Echo.Run", name: "Echo", description: "Echo input", permission: "echo.run", input: "string", output: "string", execute: async (input: string) => ok(input) });
    const runtime = createCapabilityRuntime(registry, createPermissionChecker());
    const result = await runtime.execute<string, string>("Echo.Run", "hello", { actorId: "user", permissions: ["echo.run"], metadata: {} });
    expect(result).toEqual({ ok: true, value: "hello" });
  });
});
