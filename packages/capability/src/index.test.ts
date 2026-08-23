import { describe, expect, it } from "vitest";
import { ok } from "@ai-platform-core/kernel";
import {
  communicationPlannerCapabilities,
  createCapabilityRegistry,
  createCapabilityRuntime,
  createPermissionChecker,
  platformCapabilityCatalog,
  registerCapabilityCatalog
} from "./index.js";

describe("capability", () => {
  it("executes registered capabilities with permission", async () => {
    const registry = createCapabilityRegistry();
    registry.register({
      id: "Echo.Run",
      name: "Echo",
      description: "Echo input",
      permission: "echo.run",
      input: "string",
      output: "string",
      execute: async (input: string) => ok(input)
    });
    const runtime = createCapabilityRuntime(registry, createPermissionChecker());
    const result = await runtime.execute<string, string>("Echo.Run", "hello", {
      actorId: "user",
      permissions: ["echo.run"],
      metadata: {}
    });
    expect(result).toEqual({ ok: true, value: "hello" });
  });

  it("defines Communication Planner capabilities with explicit ownership boundaries", () => {
    expect(communicationPlannerCapabilities.map((capability) => capability.id)).toEqual([
      "Communication.ContextSummarize",
      "Communication.TopicExtract",
      "Communication.PromiseExtract",
      "Communication.NextActionSuggest",
      "Communication.ReplyGenerate",
      "Communication.ReplySafetyCheck",
      "Communication.IntentClassify"
    ]);
    expect(communicationPlannerCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "Communication.ReplyGenerate",
          permission: "communication.reply.generate",
          requiredMetadata: ["workspaceId", "personId", "conversationId"],
          sourceOfTruthOwner: "Communication Planner"
        })
      ])
    );
    expect(communicationPlannerCapabilities.every((capability) => capability.sourceOfTruthOwner === "Communication Planner")).toBe(true);
    expect(platformCapabilityCatalog).toEqual(expect.arrayContaining(communicationPlannerCapabilities));
  });

  it("registers catalog capabilities and still enforces capability permission", async () => {
    const registry = createCapabilityRegistry();
    const registered = registerCapabilityCatalog(
      registry,
      communicationPlannerCapabilities,
      (item) => async () => ok({ capabilityId: item.id })
    );
    expect(registered).toEqual({ ok: true, value: undefined });

    const runtime = createCapabilityRuntime(registry, createPermissionChecker());
    await expect(
      runtime.execute("Communication.ReplyGenerate", {}, { actorId: "user", permissions: [], metadata: {} })
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "CAPABILITY_PERMISSION_DENIED" })
      })
    );

    await expect(
      runtime.execute("Communication.ReplyGenerate", {}, {
        actorId: "user",
        permissions: ["communication.reply.generate"],
        metadata: { workspaceId: "workspace", personId: "person", conversationId: "conversation" }
      })
    ).resolves.toEqual({ ok: true, value: { capabilityId: "Communication.ReplyGenerate" } });
  });
});
