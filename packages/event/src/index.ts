import { type Result, type UUID, ok } from "@ai-platform-core/kernel";

export type PlatformIntegrationEventType =
  | "Lead.Created"
  | "Lead.Qualified"
  | "Customer.Created"
  | "Reservation.Created"
  | "Reservation.Cancelled"
  | "Session.Started"
  | "Session.Completed"
  | "Document.Generated"
  | "Payment.Completed"
  | "Followup.Created"
  | "Review.Requested"
  | "Repeat.Booked";

export const platformIntegrationEventTypes = [
  "Lead.Created",
  "Lead.Qualified",
  "Customer.Created",
  "Reservation.Created",
  "Reservation.Cancelled",
  "Session.Started",
  "Session.Completed",
  "Document.Generated",
  "Payment.Completed",
  "Followup.Created",
  "Review.Requested",
  "Repeat.Booked"
] as const satisfies readonly PlatformIntegrationEventType[];

export interface DomainEvent<TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
  readonly id: UUID;
  readonly type: string;
  readonly aggregateId: UUID;
  readonly version: number;
  readonly occurredAt: Date;
  readonly payload: TPayload;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type PlatformIntegrationEvent<
  TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>
> = DomainEvent<TPayload> & {
  readonly type: PlatformIntegrationEventType;
};

export interface EventStore {
  readonly append: (events: readonly DomainEvent[]) => Promise<Result<void>>;
  readonly load: (aggregateId: UUID) => Promise<Result<readonly DomainEvent[]>>;
  readonly all: () => Promise<Result<readonly DomainEvent[]>>;
}

export interface EventSubscriber {
  readonly eventType: string;
  readonly handle: (event: DomainEvent) => Promise<Result<void>>;
}

export interface EventBus {
  readonly publish: (event: DomainEvent) => Promise<Result<void>>;
  readonly subscribe: (subscriber: EventSubscriber) => Result<void>;
}

export const createMemoryEventStore = (): EventStore => {
  const events: DomainEvent[] = [];
  return {
    append: async (newEvents) => {
      events.push(...newEvents);
      return ok(undefined);
    },
    load: async (aggregateId) =>
      ok(events.filter((event) => event.aggregateId.equals(aggregateId))),
    all: async () => ok([...events])
  };
};

export const createEventBus = (): EventBus => {
  const subscribers: EventSubscriber[] = [];
  return {
    publish: async (event) => {
      const targets = subscribers.filter(
        (subscriber) => subscriber.eventType === event.type || subscriber.eventType === "*"
      );
      for (const subscriber of targets) {
        const result = await subscriber.handle(event);
        if (!result.ok) return result;
      }
      return ok(undefined);
    },
    subscribe: (subscriber) => {
      subscribers.push(subscriber);
      return ok(undefined);
    }
  };
};

export interface EventDispatcher {
  readonly dispatch: (events: readonly DomainEvent[]) => Promise<Result<void>>;
}

export const createEventDispatcher = (
  store: EventStore,
  bus: EventBus
): EventDispatcher => ({
  dispatch: async (events) => {
    const stored = await store.append(events);
    if (!stored.ok) return stored;
    for (const event of events) {
      const published = await bus.publish(event);
      if (!published.ok) return published;
    }
    return ok(undefined);
  }
});
