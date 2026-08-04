import { type Result, type UUID, err, ok, platformError } from "@ai-platform-core/kernel";

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
  readonly query: (filter?: EventQuery) => Promise<Result<readonly DomainEvent[]>>;
  readonly all: () => Promise<Result<readonly DomainEvent[]>>;
}

export interface EventQuery {
  readonly aggregateId?: UUID;
  readonly type?: string;
  readonly types?: readonly string[];
  readonly from?: Date;
  readonly to?: Date;
}

export interface EventSubscriber {
  readonly id?: string;
  readonly eventType: string;
  readonly handle: (event: DomainEvent) => Promise<Result<void>>;
}

export interface EventSubscription {
  readonly id: string;
  readonly eventType: string;
  readonly unsubscribe: () => Result<void>;
}

export interface EventPublisher {
  readonly publish: (event: DomainEvent) => Promise<Result<void>>;
}

export interface EventSubscriberRegistry {
  readonly subscribe: (subscriber: EventSubscriber) => Result<EventSubscription>;
  readonly unsubscribe: (subscriptionId: string) => Result<void>;
}

export interface EventBus extends EventPublisher, EventSubscriberRegistry {
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
    query: async (filter = {}) =>
      ok(events.filter((event) => matchesEventQuery(event, filter))),
    all: async () => ok([...events])
  };
};

export const createEventBus = (): EventBus => {
  let nextSubscriptionId = 1;
  const subscribers = new Map<string, EventSubscriber>();
  const unsubscribe = (subscriptionId: string): Result<void> => {
    if (!subscribers.delete(subscriptionId)) {
      return err(platformError("EVENT_SUBSCRIPTION_NOT_FOUND", `Event subscription '${subscriptionId}' was not found.`));
    }
    return ok(undefined);
  };

  return {
    publish: async (event) => {
      const targets = [...subscribers.values()].filter(
        (subscriber) => subscriber.eventType === event.type || subscriber.eventType === "*"
      );
      for (const subscriber of targets) {
        const result = await subscriber.handle(event);
        if (!result.ok) return result;
      }
      return ok(undefined);
    },
    subscribe: (subscriber) => {
      const id = subscriber.id ?? `event-subscription-${String(nextSubscriptionId++)}`;
      subscribers.set(id, subscriber);
      return ok({
        id,
        eventType: subscriber.eventType,
        unsubscribe: () => unsubscribe(id)
      });
    },
    unsubscribe
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

const matchesEventQuery = (event: DomainEvent, filter: EventQuery): boolean => {
  if (filter.aggregateId && !event.aggregateId.equals(filter.aggregateId)) return false;
  if (filter.type && event.type !== filter.type) return false;
  if (filter.types && !filter.types.includes(event.type)) return false;
  if (filter.from && event.occurredAt.getTime() < filter.from.getTime()) return false;
  if (filter.to && event.occurredAt.getTime() > filter.to.getTime()) return false;
  return true;
};
