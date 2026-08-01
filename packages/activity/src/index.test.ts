import { createCryptoIdGenerator, systemClock } from "@ai-platform-core/kernel";
import { describe, expect, it } from "vitest";
import { createActivityRuntime, createMemoryActivityRepository } from "./index";

describe("activity runtime", () => {
  it("creates and completes an activity", async () => {
    const runtime = createActivityRuntime(createMemoryActivityRepository(), createCryptoIdGenerator(), systemClock());
    const created = await runtime.create({
      client: "test-client",
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
});
