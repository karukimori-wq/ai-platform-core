import { describe, expect, it } from "vitest";
import { UUID, err, ok, platformError } from "@ai-platform-core/kernel";
import {
  createEventBus,
  createEventDispatcher,
  createManagedEventBus,
  createMemoryEventStore,
  getPlatformIntegrationEventCategory,
  platformIntegrationEventTypes,
  type PlatformEventEnvelope,
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
    bus.subscribe({ eventType: "studio.session.completed.v1", handle: async (event) => { seen.push(event.type); return ok(undefined); } });
    const event: PlatformIntegrationEvent<{ readonly sessionId: string; readonly studio: string }> = {
      id,
      aggregateId: id,
      type: "studio.session.completed.v1",
      version: 1,
      occurredAt: new Date(),
      payload: { sessionId: "session-1", studio: "numeria" },
      metadata: { source: "professional-studio" }
    };

    await bus.publish(event);

    expect(platformIntegrationEventTypes).toContain("growth.customer.created.v1");
    expect(platformIntegrationEventTypes).toContain("growth.reservation.created.v1");
    expect(platformIntegrationEventTypes).toContain("studio.report.generated.v1");
    expect(platformIntegrationEventTypes).toContain("sns.post_draft.updated.v1");
    expect(platformIntegrationEventTypes).not.toContain("studio.recommendation.created.v1");
    expect(seen).toEqual(["studio.session.completed.v1"]);
  });

  it("classifies business and AI activity integration events", () => {
    expect(platformIntegrationEventTypes).toContain("sns.post_draft.created.v1");
    expect(platformIntegrationEventTypes).toContain("ai.activity.completed.v1");
    expect(getPlatformIntegrationEventCategory("studio.report.generated.v1")).toBe("business");
    expect(getPlatformIntegrationEventCategory("ai.activity.completed.v1")).toBe("ai-activity");
  });

  it("supports platform event envelope metadata", () => {
    const envelope: PlatformEventEnvelope<{ readonly activityId: string; readonly customerId: string }> = {
      eventId: "event-1",
      eventType: "ai.activity.completed.v1",
      eventVersion: 1,
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      workspaceId: "workspace-1",
      producer: "ai-platform-core",
      correlationId: "correlation-1",
      causationId: "causation-1",
      subjectType: "AIActivity",
      subjectId: "activity-1",
      partitionKey: "workspace-1",
      category: "ai-activity",
      payload: { activityId: "activity-1", customerId: "customer-1" }
    };

    expect(envelope.eventVersion).toBe(1);
    expect(envelope.payload.customerId).toBe("customer-1");
  });

  it("unsubscribes event subscribers", async () => {
    const bus = createEventBus();
    const seen: string[] = [];
    const subscription = bus.subscribe({
      eventType: "studio.session.completed.v1",
      handle: async (event) => { seen.push(event.type); return ok(undefined); }
    });
    expect(subscription.ok).toBe(true);
    if (!subscription.ok) return;

    expect(subscription.value.unsubscribe().ok).toBe(true);
    await bus.publish({
      id,
      aggregateId: id,
      type: "studio.session.completed.v1",
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
      { id, aggregateId: id, type: "growth.customer.created.v1", version: 1, occurredAt: first, payload: {}, metadata: {} },
      { id: otherId, aggregateId: otherId, type: "growth.customer.created.v1", version: 1, occurredAt: first, payload: {}, metadata: {} },
      { id, aggregateId: id, type: "studio.session.completed.v1", version: 2, occurredAt: second, payload: {}, metadata: {} }
    ]);

    const result = await store.query({
      aggregateId: id,
      types: ["studio.session.completed.v1"],
      from: new Date("2026-01-01T12:00:00.000Z")
    });

    expect(result.value.map((event) => event.type)).toEqual(["studio.session.completed.v1"]);
  });

  it("tracks managed consumer state and skips duplicate event delivery", async () => {
    const bus = createManagedEventBus();
    let handled = 0;
    bus.subscribe({
      id: "consumer-a",
      eventType: "studio.report.generated.v1",
      handle: async () => {
        handled += 1;
        return ok(undefined);
      }
    });

    const event: PlatformIntegrationEvent = {
      id,
      aggregateId: id,
      type: "studio.report.generated.v1",
      version: 1,
      occurredAt: new Date(),
      payload: {},
      metadata: {}
    };

    expect((await bus.publish(event)).ok).toBe(true);
    expect((await bus.publish(event)).ok).toBe(true);

    expect(handled).toBe(1);
    expect(bus.consumerStates()).toMatchObject([
      { consumerId: "consumer-a", eventId: id.value, status: "succeeded", attempts: 1 }
    ]);
  });

  it("retries managed consumers before succeeding", async () => {
    const bus = createManagedEventBus({
      deliveryPolicy: { maxAttempts: 3, retryDelayMs: 0, deadLetterAfterAttempts: 3 }
    });
    let attempts = 0;
    bus.subscribe({
      id: "flaky-consumer",
      eventType: "ai.activity.completed.v1",
      handle: async () => {
        attempts += 1;
        return attempts < 2
          ? err(platformError("TEMPORARY_FAILURE", "Temporary failure."))
          : ok(undefined);
      }
    });

    await bus.publish({
      id,
      aggregateId: id,
      type: "ai.activity.completed.v1",
      version: 1,
      occurredAt: new Date(),
      payload: {},
      metadata: {}
    });

    expect(attempts).toBe(2);
    expect(bus.consumerStates()).toMatchObject([
      { consumerId: "flaky-consumer", status: "succeeded", attempts: 2 }
    ]);
    expect(bus.deadLetters()).toEqual([]);
  });

  it("moves exhausted managed delivery attempts to the dead letter queue", async () => {
    const bus = createManagedEventBus({
      deliveryPolicy: { maxAttempts: 2, retryDelayMs: 0, deadLetterAfterAttempts: 2 }
    });
    bus.subscribe({
      id: "failing-consumer",
      eventType: "ai.activity.failed.v1",
      handle: async () => err(platformError("CONSUMER_FAILURE", "Consumer failed."))
    });

    await bus.publish({
      id,
      aggregateId: id,
      type: "ai.activity.failed.v1",
      version: 1,
      occurredAt: new Date(),
      payload: {},
      metadata: {}
    });

    expect(bus.consumerStates()).toMatchObject([
      { consumerId: "failing-consumer", status: "dead-lettered", attempts: 2, lastError: "Consumer failed." }
    ]);
    expect(bus.deadLetters()).toMatchObject([
      { consumerId: "failing-consumer", reason: "Consumer failed.", attempts: 2 }
    ]);
  });

  it("replays stored events through managed consumers", async () => {
    const store = createMemoryEventStore();
    const bus = createManagedEventBus({ store });
    const seen: string[] = [];
    bus.subscribe({
      id: "replay-consumer",
      eventType: "sns.post_draft.created.v1",
      handle: async (event) => {
        seen.push(event.type);
        return ok(undefined);
      }
    });
    await store.append([
      {
        id,
        aggregateId: id,
        type: "sns.post_draft.created.v1",
        version: 1,
        occurredAt: new Date(),
        payload: {},
        metadata: {}
      }
    ]);

    expect((await bus.replay({ types: ["sns.post_draft.created.v1"] })).ok).toBe(true);

    expect(seen).toEqual(["sns.post_draft.created.v1"]);
  });
});
