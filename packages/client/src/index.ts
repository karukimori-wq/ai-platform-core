import { type Result, err, ok, platformError } from "@ai-platform-core/kernel";

export type ClientType =
  | "web"
  | "line_bot"
  | "discord_bot"
  | "slack_bot"
  | "gmail_assistant"
  | "sns_bot"
  | "cli"
  | "api"
  | "ai_employee"
  | "other";

export interface ClientBudgetPolicy {
  readonly monthlyTokenLimit?: number;
  readonly monthlyCostLimit?: number;
  readonly currency?: string;
}

export interface ClientManifest {
  readonly id: string;
  readonly name: string;
  readonly type: ClientType;
  readonly version: string;
  readonly provider?: string;
  readonly capabilities: readonly string[];
  readonly knowledge: readonly string[];
  readonly analytics: boolean;
  readonly budget?: ClientBudgetPolicy;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ClientRegistry {
  readonly register: (manifest: ClientManifest) => Result<void>;
  readonly get: (id: string) => Result<ClientManifest>;
  readonly list: () => readonly ClientManifest[];
  readonly canUseCapability: (clientId: string, capabilityId: string) => Result<void>;
}

export const validateClientManifest = (manifest: ClientManifest): Result<void> => {
  if (manifest.id.trim().length === 0) {
    return err(platformError("CLIENT_MANIFEST_INVALID", "Client id is required."));
  }
  if (manifest.name.trim().length === 0) {
    return err(platformError("CLIENT_MANIFEST_INVALID", "Client name is required."));
  }
  if (manifest.version.trim().length === 0) {
    return err(platformError("CLIENT_MANIFEST_INVALID", "Client version is required."));
  }
  if (manifest.capabilities.length === 0) {
    return err(platformError("CLIENT_MANIFEST_INVALID", "Client must declare at least one capability."));
  }
  return ok(undefined);
};

export const createClientRegistry = (): ClientRegistry => {
  const clients = new Map<string, ClientManifest>();
  return {
    register: (manifest) => {
      const valid = validateClientManifest(manifest);
      if (!valid.ok) return valid;
      clients.set(manifest.id, manifest);
      return ok(undefined);
    },
    get: (id) => {
      const client = clients.get(id);
      return client === undefined
        ? err(platformError("CLIENT_NOT_FOUND", `Client '${id}' was not registered.`))
        : ok(client);
    },
    list: () => [...clients.values()],
    canUseCapability: (clientId, capabilityId) => {
      const client = clients.get(clientId);
      if (client === undefined) {
        return err(platformError("CLIENT_NOT_FOUND", `Client '${clientId}' was not registered.`));
      }
      return client.capabilities.includes(capabilityId)
        ? ok(undefined)
        : err(platformError("CLIENT_CAPABILITY_NOT_ALLOWED", `Client '${clientId}' cannot use '${capabilityId}'.`));
    }
  };
};
