import { createCryptoIdGenerator, systemClock } from "@ai-platform-core/kernel";
import { createEventBus, createEventDispatcher, createMemoryEventStore } from "@ai-platform-core/event";
import { describe, expect, it } from "vitest";
import { createActivityRuntime, createMemoryActivityRepository } from "./index";

describe("activity runtime", () => {
  it("creates and completes an activity", async () => {
    const runtime = createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock());
    const created = await runtime.create({
      client: "test-client",
      workspaceId: "workspace-1",
      userId: "user-1",
      capability: "Estimate.Create",
      goal: "Create an estimate",
      context: {},
      input: {}
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const completed = await runtime.complete({
      activityId: created.value.id.value,
      output: { text: "done" },
      provider: "memory",
      model: "test",
      tokens: { input: 1, output: 2, total: 3 },
      cost: { amount: 0, currency: "USD" },
      latencyMs: 4,
      knowledgeUsed: []
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.value.status).toBe("completed");
  });

  it("dispatches lifecycle events when a dispatcher is provided", async () => {
    const store = createMemoryEventStore();
    const runtime = createActivityRuntime(
      createMemoryActivityRepository(),
      createCryptoIdGenerator(),
      systemClock(),
      createEventDispatcher(store, createEventBus())
    );
    const created = await runtime.create({
      client: "test-client",
      workspaceId: "workspace-1",
      userId: "user-1",
      ownerUserId: "user-1",
      capability: "Estimate.Create",
      goal: "Create an estimate",
      context: {},
      input: {}
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await runtime.transition(created.value.id.value, "running");
    const events = await store.load(created.value.id);
    expect(events.ok).toBe(true);
    if (!events.ok) return;
    expect(events.value.map((event) => event.type)).toEqual(["ActivityCreated", "ActivityStatusChanged"]);
    expect(events.value[0]?.payload).toMatchObject({
      workspaceId: "workspace-1",
      userId: "user-1",
      ownerUserId: "user-1"
    });
  });
});
