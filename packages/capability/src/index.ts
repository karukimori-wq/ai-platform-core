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

export interface CapabilityCatalogItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly permission: string;
  readonly input: string;
  readonly output: string;
  readonly requiredMetadata?: readonly string[];
  readonly sourceOfTruthOwner?: string;
}

export const communicationPlannerCapabilities = [
  {
    id: "Communication.ContextSummarize",
    name: "Communication Context Summarize",
    description:
      "Summarize Communication Planner person-scoped conversation context without owning the context record.",
    permission: "communication.context.summarize",
    input: "workspaceId + personId + Communication Planner context references",
    output: "person-scoped context summary candidate",
    requiredMetadata: ["workspaceId", "personId"],
    sourceOfTruthOwner: "Communication Planner"
  },
  {
    id: "Communication.TopicExtract",
    name: "Communication Topic Extract",
    description: "Extract topic candidates from a Communication Planner conversation scope.",
    permission: "communication.topic.extract",
    input: "workspaceId + personId + conversationId + message references",
    output: "topic candidates for Communication Planner",
    requiredMetadata: ["workspaceId", "personId", "conversationId"],
    sourceOfTruthOwner: "Communication Planner"
  },
  {
    id: "Communication.PromiseExtract",
    name: "Communication Promise Extract",
    description: "Extract promise candidates from a Communication Planner conversation scope.",
    permission: "communication.promise.extract",
    input: "workspaceId + personId + conversationId + message references",
    output: "promise candidates for Communication Planner",
    requiredMetadata: ["workspaceId", "personId", "conversationId"],
    sourceOfTruthOwner: "Communication Planner"
  },
  {
    id: "Communication.NextActionSuggest",
    name: "Communication Next Action Suggest",
    description: "Suggest next action candidates for a Communication Planner person and conversation scope.",
    permission: "communication.next_action.suggest",
    input: "workspaceId + personId + conversationId + context references",
    output: "next action candidates for Communication Planner",
    requiredMetadata: ["workspaceId", "personId", "conversationId"],
    sourceOfTruthOwner: "Communication Planner"
  },
  {
    id: "Communication.ReplyGenerate",
    name: "Communication Reply Generate",
    description: "Generate a reply draft candidate using only same-person context supplied by Communication Planner.",
    permission: "communication.reply.generate",
    input: "workspaceId + personId + conversationId + same-person context",
    output: "reply draft candidate for Communication Planner SafetyCheck",
    requiredMetadata: ["workspaceId", "personId", "conversationId"],
    sourceOfTruthOwner: "Communication Planner"
  },
  {
    id: "Communication.ReplySafetyCheck",
    name: "Communication Reply Safety Check",
    description:
      "Evaluate a reply draft candidate for Communication Planner while leaving send authority with Communication Planner.",
    permission: "communication.reply.safety_check",
    input: "workspaceId + personId + conversationId + replyDraftId + draft content hash",
    output: "safety check recommendation for Communication Planner",
    requiredMetadata: ["workspaceId", "personId", "conversationId", "replyDraftId"],
    sourceOfTruthOwner: "Communication Planner"
  },
  {
    id: "Communication.IntentClassify",
    name: "Communication Intent Classify",
    description: "Classify communication intent within a Communication Planner person and conversation scope.",
    permission: "communication.intent.classify",
    input: "workspaceId + personId + conversationId + message references",
    output: "intent classification candidate for Communication Planner",
    requiredMetadata: ["workspaceId", "personId", "conversationId"],
    sourceOfTruthOwner: "Communication Planner"
  }
] as const satisfies readonly CapabilityCatalogItem[];

export const platformCapabilityCatalog = [
  ...communicationPlannerCapabilities
] as const satisfies readonly CapabilityCatalogItem[];

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

export const registerCapabilityCatalog = (
  registry: CapabilityRegistry,
  catalog: readonly CapabilityCatalogItem[],
  createExecutor: (item: CapabilityCatalogItem) => Capability<unknown, unknown>["execute"]
): Result<void> => {
  for (const item of catalog) {
    const registered = registry.register({
      id: item.id,
      name: item.name,
      description: item.description,
      permission: item.permission,
      input: item.input,
      output: item.output,
      execute: createExecutor(item)
    });
    if (!registered.ok) return registered;
  }
  return ok(undefined);
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
