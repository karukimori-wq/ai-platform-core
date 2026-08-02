import { type Result, err, ok, platformError } from "@ai-platform-core/kernel";

export interface CapabilityContext {
  readonly actorId: string;
  readonly permissions: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface Capability<I, O> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly permission: string;
  readonly input: string;
  readonly output: string;
  readonly execute: (input: I, context: CapabilityContext) => Promise<Result<O>>;
}

export interface CapabilityRegistry {
  readonly register: <I, O>(capability: Capability<I, O>) => Result<void>;
  readonly get: <I, O>(id: string) => Result<Capability<I, O>>;
  readonly list: () => readonly Capability<unknown, unknown>[];
}

export const createCapabilityRegistry = (): CapabilityRegistry => {
  const capabilities = new Map<string, Capability<unknown, unknown>>();
  return {
    register: (capability) => {
      capabilities.set(capability.id, capability as Capability<unknown, unknown>);
      return ok(undefined);
    },
    get: <I, O>(id: string) => {
      const capability = capabilities.get(id);
      return capability === undefined
        ? err(platformError("CAPABILITY_NOT_FOUND", `Capability '${id}' was not registered.`))
        : ok(capability as Capability<I, O>);
    },
    list: () => [...capabilities.values()]
  };
};

export interface PermissionChecker {
  readonly canExecute: <I, O>(
    capability: Capability<I, O>,
    context: CapabilityContext
  ) => Result<void>;
}

export const createPermissionChecker = (): PermissionChecker => ({
  canExecute: (capability, context) =>
    context.permissions.includes(capability.permission)
      ? ok(undefined)
      : err(platformError("CAPABILITY_PERMISSION_DENIED", "Actor cannot execute this capability."))
});

export interface CapabilityRuntime {
  readonly execute: <I, O>(id: string, input: I, context: CapabilityContext) => Promise<Result<O>>;
}

export const createCapabilityRuntime = (
  registry: CapabilityRegistry,
  permissionChecker: PermissionChecker
): CapabilityRuntime => ({
  execute: async <I, O>(id: string, input: I, context: CapabilityContext) => {
    const capability = registry.get<I, O>(id);
    if (!capability.ok) return capability;
    const permission = permissionChecker.canExecute(capability.value, context);
    if (!permission.ok) return permission;
    return capability.value.execute(input, context);
  }
});
