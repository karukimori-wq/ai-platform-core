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

export type EventAuditAction =
  | "published"
  | "delivery_succeeded"
  | "delivery_failed"
  | "dead_lettered"
  | "replayed";

export interface EventAuditRecord {
  readonly action: EventAuditAction;
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly consumerId?: string;
  readonly details: Readonly<Record<string, unknown>>;
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

export interface ManagedEventBus extends EventBus {
  readonly consumerStates: () => readonly EventConsumerState[];
  readonly deadLetters: () => readonly DeadLetterEvent[];
  readonly auditLogs: () => readonly EventAuditRecord[];
  readonly replay: (filter?: EventQuery) => Promise<Result<void>>;
}

export interface ManagedEventBusOptions {
  readonly store?: EventStore;
  readonly deliveryPolicy?: EventDeliveryPolicy;
  readonly now?: () => Date;
}

export const defaultEventDeliveryPolicy: EventDeliveryPolicy = {
  maxAttempts: 3,
  retryDelayMs: 0,
  deadLetterAfterAttempts: 3
};

export const createMemoryEventStore = (): EventStore => {
  const events: DomainEvent[] = [];
  return {
    append: async (newEvents) => {
      const existing = new Set(events.map((event) => event.id.value));
      for (const event of newEvents) {
        if (!existing.has(event.id.value)) {
          events.push(event);
          existing.add(event.id.value);
        }
      }
      return ok(undefined);
    },
    load: async (aggregateId) =>
      ok(events.filter((event) => event.aggregateId.equals(aggregateId))),
    query: async (filter = {}) =>
      ok(events.filter((event) => matchesEventQuery(event, filter))),
    all: async () => ok([...events])
  };
};

export const createManagedEventBus = (options: ManagedEventBusOptions = {}): ManagedEventBus => {
  let nextSubscriptionId = 1;
  const subscribers = new Map<string, EventSubscriber>();
  const consumerStates = new Map<string, EventConsumerState>();
  const deadLetters: DeadLetterEvent[] = [];
  const auditLogs: EventAuditRecord[] = [];
  const deliveryPolicy = options.deliveryPolicy ?? defaultEventDeliveryPolicy;
  const now = options.now ?? (() => new Date());

  const unsubscribe = (subscriptionId: string): Result<void> => {
    if (!subscribers.delete(subscriptionId)) {
      return err(platformError("EVENT_SUBSCRIPTION_NOT_FOUND", `Event subscription '${subscriptionId}' was not found.`));
    }
    return ok(undefined);
  };

  const updateConsumerState = (
    consumerId: string,
    event: DomainEvent,
    status: EventDeliveryStatus,
    attempts: number,
    lastError?: string
  ): EventConsumerState => {
    const state: EventConsumerState = {
      consumerId,
      eventId: event.id.value,
      status,
      attempts,
      updatedAt: now(),
      ...(lastError === undefined ? {} : { lastError })
    };
    consumerStates.set(toConsumerStateKey(consumerId, event), state);
    return state;
  };

  const appendAuditLog = (
    action: EventAuditAction,
    event: DomainEvent,
    consumerId?: string,
    details: Readonly<Record<string, unknown>> = {}
  ): void => {
    auditLogs.push({
      action,
      eventId: event.id.value,
      eventType: event.type,
      occurredAt: now(),
      details,
      ...(consumerId === undefined ? {} : { consumerId })
    });
  };

  const deliverToSubscriber = async (subscriber: EventSubscriber, event: DomainEvent): Promise<Result<void>> => {
    const consumerId = subscriber.id ?? subscriber.eventType;
    const stateKey = toConsumerStateKey(consumerId, event);
    const existing = consumerStates.get(stateKey);
    if (existing?.status === "succeeded" || existing?.status === "dead-lettered") {
      return ok(undefined);
    }

    let attempts = existing?.attempts ?? 0;
    while (attempts < deliveryPolicy.maxAttempts) {
      attempts += 1;
      updateConsumerState(consumerId, event, "processing", attempts);
      const handled = await subscriber.handle(event);
      if (handled.ok) {
        updateConsumerState(consumerId, event, "succeeded", attempts);
        appendAuditLog("delivery_succeeded", event, consumerId, { attempts });
        return ok(undefined);
      }

      if (attempts >= deliveryPolicy.deadLetterAfterAttempts || attempts >= deliveryPolicy.maxAttempts) {
        const state = updateConsumerState(consumerId, event, "dead-lettered", attempts, handled.error.message);
        deadLetters.push({
          event,
          consumerId,
          reason: state.lastError ?? "Event delivery failed.",
          failedAt: state.updatedAt,
          attempts
        });
        appendAuditLog("dead_lettered", event, consumerId, {
          attempts,
          reason: state.lastError ?? "Event delivery failed."
        });
        return ok(undefined);
      }

      updateConsumerState(consumerId, event, "failed", attempts, handled.error.message);
      appendAuditLog("delivery_failed", event, consumerId, {
        attempts,
        reason: handled.error.message
      });
    }

    return ok(undefined);
  };

  const publish = async (event: DomainEvent): Promise<Result<void>> => {
    appendAuditLog("published", event);
    const targets = [...subscribers.values()].filter(
      (subscriber) => subscriber.eventType === event.type || subscriber.eventType === "*"
    );
    for (const subscriber of targets) {
      const delivered = await deliverToSubscriber(subscriber, event);
      if (!delivered.ok) return delivered;
    }
    return ok(undefined);
  };

  return {
    publish,
    subscribe: (subscriber) => {
      const id = subscriber.id ?? `event-subscription-${String(nextSubscriptionId++)}`;
      subscribers.set(id, { ...subscriber, id });
      return ok({
        id,
        eventType: subscriber.eventType,
        unsubscribe: () => unsubscribe(id)
      });
    },
    unsubscribe,
    consumerStates: () => [...consumerStates.values()],
    deadLetters: () => [...deadLetters],
    auditLogs: () => [...auditLogs],
    replay: async (filter = {}) => {
      if (!options.store) {
        return err(platformError("EVENT_STORE_NOT_CONFIGURED", "Managed event replay requires an EventStore."));
      }
      const events = await options.store.query(filter);
      if (!events.ok) return events;
      for (const event of events.value) {
        appendAuditLog("replayed", event, undefined, { filter });
        const delivered = await publish(event);
        if (!delivered.ok) return delivered;
      }
      return ok(undefined);
    }
  };
};

export const createPlatformEventEnvelopeValidator = (
  allowedEventTypes: readonly PlatformIntegrationEventType[] = platformIntegrationEventTypes
): EventSchemaValidator => ({
  validate: (event) => {
    if (!isNonEmptyString(event.eventId)) {
      return err(platformError("INVALID_EVENT_ENVELOPE", "Event envelope requires eventId."));
    }
    if (!allowedEventTypes.includes(event.eventType)) {
      return err(platformError("INVALID_EVENT_TYPE", `Event type '${event.eventType}' is not allowed.`));
    }
    if (!Number.isInteger(event.eventVersion) || event.eventVersion < 1) {
      return err(platformError("INVALID_EVENT_VERSION", "Event version must be a positive integer."));
    }
    if (Number.isNaN(event.occurredAt.getTime())) {
      return err(platformError("INVALID_EVENT_OCCURRED_AT", "Event occurredAt must be a valid Date."));
    }
    if (!isNonEmptyString(event.workspaceId)) {
      return err(platformError("INVALID_EVENT_ENVELOPE", "Event envelope requires workspaceId."));
    }
    if (!isNonEmptyString(event.producer)) {
      return err(platformError("INVALID_EVENT_ENVELOPE", "Event envelope requires producer."));
    }
    if (!isNonEmptyString(event.correlationId)) {
      return err(platformError("INVALID_EVENT_ENVELOPE", "Event envelope requires correlationId."));
    }
    if (!isNonEmptyString(event.subjectType) || !isNonEmptyString(event.subjectId)) {
      return err(platformError("INVALID_EVENT_ENVELOPE", "Event envelope requires subjectType and subjectId."));
    }
    if (event.category !== getPlatformIntegrationEventCategory(event.eventType)) {
      return err(platformError("INVALID_EVENT_CATEGORY", "Event category does not match eventType."));
    }
    return ok(undefined);
  }
});

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

const toConsumerStateKey = (consumerId: string, event: DomainEvent): string => `${consumerId}:${event.id.value}`;

const isNonEmptyString = (value: string): boolean => value.trim().length > 0;

const matchesEventQuery = (event: DomainEvent, filter: EventQuery): boolean => {
  if (filter.aggregateId && !event.aggregateId.equals(filter.aggregateId)) return false;
  if (filter.type && event.type !== filter.type) return false;
  if (filter.types && !filter.types.includes(event.type)) return false;
  if (filter.from && event.occurredAt.getTime() < filter.from.getTime()) return false;
  if (filter.to && event.occurredAt.getTime() > filter.to.getTime()) return false;
  return true;
};
