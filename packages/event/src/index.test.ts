import { describe, expect, it } from "vitest";
import { UUID, ok } from "@ai-platform-core/kernel";
import {
  createEventBus,
  createEventDispatcher,
  createMemoryEventStore,
  platformIntegrationEventTypes,
  type PlatformIntegrationEvent
} from "./index.js";

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

  it("publishes platform integration events", async () => {
    const bus = createEventBus();
    const seen: string[] = [];
    bus.subscribe({ eventType: "Session.Completed", handle: async (event) => { seen.push(event.type); return ok(undefined); } });
    const event: PlatformIntegrationEvent<{ readonly sessionId: string; readonly studio: string }> = {
      id,
      aggregateId: id,
      type: "Session.Completed",
      version: 1,
      occurredAt: new Date(),
      payload: { sessionId: "session-1", studio: "numeria" },
      metadata: { source: "professional-studio" }
    };

    await bus.publish(event);

    expect(platformIntegrationEventTypes).toContain("Lead.Created");
    expect(platformIntegrationEventTypes).toContain("Payment.Completed");
    expect(seen).toEqual(["Session.Completed"]);
  });

  it("unsubscribes event subscribers", async () => {
    const bus = createEventBus();
    const seen: string[] = [];
    const subscription = bus.subscribe({
      eventType: "Session.Completed",
      handle: async (event) => { seen.push(event.type); return ok(undefined); }
    });
    expect(subscription.ok).toBe(true);
    if (!subscription.ok) return;

    expect(subscription.value.unsubscribe().ok).toBe(true);
    await bus.publish({
      id,
      aggregateId: id,
      type: "Session.Completed",
      version: 1,
      occurredAt: new Date(),
      payload: {},
      metadata: {}
    });

    expect(seen).toEqual([]);
  });

  it("queries stored events by aggregate, type, and time", async () => {
    const store = createMemoryEventStore();
    const otherId = UUID.create("22222222-2222-4222-8222-222222222222").value;
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");
    await store.append([
      { id, aggregateId: id, type: "Lead.Created", version: 1, occurredAt: first, payload: {}, metadata: {} },
      { id: otherId, aggregateId: otherId, type: "Lead.Created", version: 1, occurredAt: first, payload: {}, metadata: {} },
      { id, aggregateId: id, type: "Session.Completed", version: 2, occurredAt: second, payload: {}, metadata: {} }
    ]);

    const result = await store.query({
      aggregateId: id,
      types: ["Session.Completed"],
      from: new Date("2026-01-01T12:00:00.000Z")
    });

    expect(result.value.map((event) => event.type)).toEqual(["Session.Completed"]);
  });
});
