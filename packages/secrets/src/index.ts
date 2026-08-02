import { type Result, err, ok, platformError } from "@ai-platform-core/kernel";

export interface SecretValue {
  readonly key: string;
  readonly value: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SecretStore {
  readonly set: (key: string, value: string) => Promise<Result<SecretValue>>;
  readonly get: (key: string) => Promise<Result<SecretValue>>;
  readonly has: (key: string) => Promise<Result<boolean>>;
  readonly delete: (key: string) => Promise<Result<void>>;
}

export interface SecretReader {
  readonly get: (key: string) => Promise<Result<string>>;
}

export const createMemorySecretStore = (): SecretStore => {
  const secrets = new Map<string, SecretValue>();
  return {
    set: async (key, value) => {
      const current = secrets.get(key);
      const now = new Date();
      const secret: SecretValue = {
        key,
        value,
        createdAt: current?.createdAt ?? now,
        updatedAt: now
      };
      secrets.set(key, secret);
      return ok(secret);
    },
    get: async (key) => {
      const secret = secrets.get(key);
      return secret === undefined
        ? err(platformError("SECRET_NOT_FOUND", `Secret '${key}' was not found.`))
        : ok(secret);
    },
    has: async (key) => ok(secrets.has(key)),
    delete: async (key) => {
      secrets.delete(key);
      return ok(undefined);
    }
  };
};

export const createSecretReader = (store: SecretStore): SecretReader => ({
  get: async (key) => {
    const secret = await store.get(key);
    return secret.ok ? ok(secret.value.value) : secret;
  }
});

export const createEnvironmentSecretReader = (
  env: Readonly<Record<string, string | undefined>>
): SecretReader => ({
  get: async (key) => {
    const value = env[key];
    return value === undefined
      ? err(platformError("SECRET_NOT_FOUND", `Secret '${key}' was not found.`))
      : ok(value);
  }
});
