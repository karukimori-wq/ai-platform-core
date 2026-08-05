import { type Result, type UUID, err, ok, platformError } from "@ai-platform-core/kernel";

export type PlatformIntegrationEventType =
  | "growth.customer.created.v1"
  | "growth.customer.updated.v1"
  | "growth.lead.converted.v1"
  | "growth.reservation.created.v1"
  | "growth.reservation.cancelled.v1"
  | "studio.session.started.v1"
  | "studio.session.completed.v1"
  | "studio.report.generated.v1"
  | "studio.service_reference.updated.v1"
  | "ai.activity.created.v1"
  | "ai.activity.completed.v1"
  | "ai.activity.failed.v1"
  | "ai.usage.recorded.v1"
  | "sns.post_draft.created.v1"
  | "sns.post_draft.updated.v1";

export const platformIntegrationEventTypes = [
  "growth.customer.created.v1",
  "growth.customer.updated.v1",
  "growth.lead.converted.v1",
  "growth.reservation.created.v1",
  "growth.reservation.cancelled.v1",
  "studio.session.started.v1",
  "studio.session.completed.v1",
  "studio.report.generated.v1",
  "studio.service_reference.updated.v1",
  "ai.activity.created.v1",
  "ai.activity.completed.v1",
  "ai.activity.failed.v1",
  "ai.usage.recorded.v1",
  "sns.post_draft.created.v1",
  "sns.post_draft.updated.v1"
] as const satisfies readonly PlatformIntegrationEventType[];

export type EventCategory = "business" | "ai-activity";

export const getPlatformIntegrationEventCategory = (
  eventType: PlatformIntegrationEventType
): EventCategory => eventType.startsWith("ai.") ? "ai-activity" : "business";

export interface DomainEvent<TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
  readonly id: UUID;
  readonly type: string;
  readonly aggregateId: UUID;
  readonly version: number;
  readonly occurredAt: Date;
  readonly payload: TPayload;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface PlatformEventEnvelope<
  TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>
> {
  readonly eventId: string;
  readonly eventType: PlatformIntegrationEventType;
  readonly eventVersion: number;
  readonly occurredAt: Date;
  readonly workspaceId: string;
  readonly producer: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly partitionKey?: string;
  readonly category: EventCategory;
  readonly payload: TPayload;
}

export type PlatformIntegrationEvent<
  TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>
> = DomainEvent<TPayload> & {
  readonly type: PlatformIntegrationEventType;
};

export type EventDeliveryStatus = "pending" | "processing" | "succeeded" | "failed" | "dead-lettered";

export interface EventConsumerState {
  readonly consumerId: string;
  readonly eventId: string;
  readonly status: EventDeliveryStatus;
  readonly attempts: number;
  readonly lastError?: string;
  readonly updatedAt: Date;
}

export interface DeadLetterEvent {
  readonly event: DomainEvent;
  readonly consumerId: string;
  readonly reason: string;
  readonly failedAt: Date;
  readonly attempts: number;
}

export interface EventSchemaValidator {
  readonly validate: (event: PlatformEventEnvelope) => Result<void>;
}

export interface EventDeliveryPolicy {
  readonly maxAttempts: number;
  readonly retryDelayMs: number;
  readonly deadLetterAfterAttempts: number;
}

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
