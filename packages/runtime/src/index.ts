import {
  createCapabilityRegistry,
  createCapabilityRuntime,
  createPermissionChecker,
  type CapabilityRuntime
} from "@ai-platform-core/capability";
import { createEventBus, createEventDispatcher, createMemoryEventStore } from "@ai-platform-core/event";
import { createNoopLogger, systemClock, type Clock, type Logger } from "@ai-platform-core/kernel";
import { createPluginRuntime, type PluginRuntime } from "@ai-platform-core/plugin";
import { createMemoryKeyValueStore, type KeyValueStore } from "@ai-platform-core/storage";
import { createWorkflowRuntime, type WorkflowRuntime } from "@ai-platform-core/workflow";

export interface AIRuntime {
  readonly selectModel: (task: string) => Promise<string>;
}

export interface PlatformRuntime {
  readonly registry: ReturnType<typeof createCapabilityRegistry>;
  readonly capability: CapabilityRuntime;
  readonly workflow: WorkflowRuntime;
  readonly plugin: PluginRuntime;
  readonly storage: KeyValueStore<Readonly<Record<string, unknown>>>;
  readonly ai?: AIRuntime;
  readonly clock: Clock;
  readonly logger: Logger;
}

export const createPlatformRuntime = (): PlatformRuntime => {
  const registry = createCapabilityRegistry();
  const capability = createCapabilityRuntime(registry, createPermissionChecker());
  const store = createMemoryEventStore();
  const bus = createEventBus();
  createEventDispatcher(store, bus);
  return {
    registry,
    capability,
    workflow: createWorkflowRuntime(capability),
    plugin: createPluginRuntime(),
    storage: createMemoryKeyValueStore(),
    clock: systemClock(),
    logger: createNoopLogger()
  };
};
