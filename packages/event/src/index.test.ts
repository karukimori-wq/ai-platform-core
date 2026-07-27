import { describe, expect, it } from "vitest";
import { UUID, ok } from "@ai-platform-core/kernel";
import { createEventBus, createEventDispatcher, createMemoryEventStore } from "./index.js";

const id = UUID.create("11111111-1111-4111-8111-111111111111").value;

describe("event", () => {
  it("stores and publishes events", async () => {
    const store = createMemoryEventStore();
    const bus = createEventBus();
    const seen: string[] = [];
    bus.subscribe({ eventType: "ThingHappened", handle: async (event) => { seen.push(event.type); return ok(undefined); } });
    const dispatcher = createEventDispatcher(store, bus);
    await dispatcher.dispatch([{ id, aggregateId: id, type: "ThingHappened", version: 1, occurredAt: new Date(), payload: {}, metadata: {} }]);
    expect(seen).toEqual(["ThingHappened"]);
    expect((await store.load(id)).value).toHaveLength(1);
  });
});
