import {
  createCapabilityRegistry,
  createCapabilityRuntime,
  createPermissionChecker,
  type CapabilityRuntime
} from "@ai-platform-core/capability";
import { createEventBus, createEventDispatcher, createMemoryEventStore } from "@ai-platform-core/event";
import { createNoopLogger, systemClock, type Clock, type Logger } from "@ai-platform-core/kernel";
import { createPluginRuntime, type PluginRuntime } from "@ai-platform-core/plugin";
import { createWorkflowRuntime, type WorkflowRuntime } from "@ai-platform-core/workflow";

export interface AIRuntime {
  readonly selectModel: (task: string) => Promise<string>;
}

export interface PlatformRuntime {
  readonly capability: CapabilityRuntime;
  readonly workflow: WorkflowRuntime;
  readonly plugin: PluginRuntime;
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
    capability,
    workflow: createWorkflowRuntime(capability),
    plugin: createPluginRuntime(),
    clock: systemClock(),
    logger: createNoopLogger()
  };
};
