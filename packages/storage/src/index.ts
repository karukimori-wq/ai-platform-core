import { type Result, err, ok, platformError } from "@ai-platform-core/kernel";

export interface StorageRecord<T extends Readonly<Record<string, unknown>>> {
  readonly id: string;
  readonly value: T;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface KeyValueStore<T extends Readonly<Record<string, unknown>>> {
  readonly put: (id: string, value: T) => Promise<Result<StorageRecord<T>>>;
  readonly get: (id: string) => Promise<Result<StorageRecord<T>>>;
  readonly list: () => Promise<Result<readonly StorageRecord<T>[]>>;
  readonly delete: (id: string) => Promise<Result<void>>;
}

export const createMemoryKeyValueStore = <
  T extends Readonly<Record<string, unknown>>
>(): KeyValueStore<T> => {
  const records = new Map<string, StorageRecord<T>>();
  return {
    put: async (id, value) => {
      const current = records.get(id);
      const record: StorageRecord<T> = {
        id,
        value,
        version: current === undefined ? 1 : current.version + 1,
        updatedAt: new Date()
      };
      records.set(id, record);
      return ok(record);
    },
    get: async (id) => {
      const record = records.get(id);
      return record === undefined
        ? err(platformError("STORAGE_RECORD_NOT_FOUND", `Storage record '${id}' was not found.`))
        : ok(record);
    },
    list: async () => ok([...records.values()]),
    delete: async (id) => {
      records.delete(id);
      return ok(undefined);
    }
  };
};

export interface EnvironmentReader {
  readonly get: (key: string) => Result<string>;
}

export const createEnvironmentReader = (
  env: Readonly<Record<string, string | undefined>>
): EnvironmentReader => ({
  get: (key) => {
    const value = env[key];
    return value === undefined
      ? err(platformError("ENVIRONMENT_VALUE_NOT_FOUND", `Environment value '${key}' was not found.`))
      : ok(value);
  }
});
