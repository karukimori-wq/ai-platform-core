import { describe, expect, it } from "vitest";
import { ok } from "@ai-platform-core/kernel";
import { createCapabilityRegistry, createCapabilityRuntime, createPermissionChecker } from "@ai-platform-core/capability";
import { createWorkflowRuntime } from "./index.js";

describe("workflow", () => {
  it("runs capability steps", async () => {
    const registry = createCapabilityRegistry();
    registry.register({ id: "Text.Uppercase", name: "Uppercase", description: "Uppercase text", permission: "text.uppercase", input: "string", output: "string", execute: async (input: string) => ok(input.toUpperCase()) });
    const runtime = createWorkflowRuntime(createCapabilityRuntime(registry, createPermissionChecker()));
    const result = await runtime.start({ id: "wf", name: "Workflow", steps: [{ id: "step-1", capabilityId: "Text.Uppercase", input: (state) => String(state["text"]), outputKey: "upper" }] }, { text: "core" }, { actorId: "user", permissions: ["text.uppercase"], metadata: {} });
    expect(result.ok && result.value.state["upper"]).toBe("CORE");
  });
});
