export type Result<T, E extends PlatformError = PlatformError> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E extends PlatformError> {
  readonly ok: false;
  readonly error: E;
}

export interface PlatformError {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E extends PlatformError>(error: E): Err<E> => ({ ok: false, error });

export const platformError = (
  code: string,
  message: string,
  cause?: unknown
): PlatformError => ({ code, message, cause });

export interface Logger {
  readonly debug: (message: string, context?: Readonly<Record<string, unknown>>) => void;
  readonly info: (message: string, context?: Readonly<Record<string, unknown>>) => void;
  readonly warn: (message: string, context?: Readonly<Record<string, unknown>>) => void;
  readonly error: (message: string, context?: Readonly<Record<string, unknown>>) => void;
}

export const createNoopLogger = (): Logger => ({
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
});

export interface Clock {
  readonly now: () => Date;
}

export const systemClock = (): Clock => ({ now: () => new Date() });

export interface IdGenerator {
  readonly uuid: () => UUID;
}

export const createCryptoIdGenerator = (): IdGenerator => ({
  uuid: () => {
    const id = UUID.create(globalThis.crypto.randomUUID());
    if (!id.ok) {
      return new UUID("00000000-0000-4000-8000-000000000000");
    }
    return id.value;
  }
});

export interface Config {
  readonly get: (key: string) => Result<string>;
}

export const createEnvironmentConfig = (env: Readonly<Record<string, string | undefined>>): Config => ({
  get: (key) => {
    const value = env[key];
    return value === undefined
      ? err(platformError("CONFIG_NOT_FOUND", `Config key '${key}' was not found.`))
      : ok(value);
  }
});

export interface Entity<Props extends Readonly<Record<string, unknown>>> {
  readonly id: UUID;
  readonly props: Props;
}

export abstract class ValueObject<T> {
  protected constructor(public readonly value: T) {}

  public equals(other: ValueObject<T>): boolean {
    return Object.is(this.value, other.value);
  }
}

export class UUID extends ValueObject<string> {
  private static readonly pattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

  public constructor(value: string) {
    super(value);
  }

  public static create(value: string): Result<UUID> {
    return UUID.pattern.test(value)
      ? ok(new UUID(value))
      : err(platformError("INVALID_UUID", "UUID must be RFC 4122 compatible."));
  }
}

export class Email extends ValueObject<string> {
  public static create(value: string): Result<Email> {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
      ? ok(new Email(value))
      : err(platformError("INVALID_EMAIL", "Email format is invalid."));
  }
}

export class Phone extends ValueObject<string> {
  public static create(value: string): Result<Phone> {
    return /^[0-9+\-()\s]{7,20}$/u.test(value)
      ? ok(new Phone(value))
      : err(platformError("INVALID_PHONE", "Phone format is invalid."));
  }
}

export class Money extends ValueObject<Readonly<{ amount: number; currency: string }>> {
  public static create(amount: number, currency: string): Result<Money> {
    if (!Number.isFinite(amount)) {
      return err(platformError("INVALID_MONEY_AMOUNT", "Money amount must be finite."));
    }
    if (!/^[A-Z]{3}$/u.test(currency)) {
      return err(platformError("INVALID_CURRENCY", "Currency must be ISO 4217 style."));
    }
    return ok(new Money({ amount, currency }));
  }
}

export class Percentage extends ValueObject<number> {
  public static create(value: number): Result<Percentage> {
    return value >= 0 && value <= 100
      ? ok(new Percentage(value))
      : err(platformError("INVALID_PERCENTAGE", "Percentage must be between 0 and 100."));
  }
}

export class DateRange extends ValueObject<Readonly<{ start: Date; end: Date }>> {
  public static create(start: Date, end: Date): Result<DateRange> {
    return start.getTime() <= end.getTime()
      ? ok(new DateRange({ start, end }))
      : err(platformError("INVALID_DATE_RANGE", "DateRange start must be before end."));
  }
}

export interface Container {
  readonly register: <T>(token: string, value: T) => Result<void>;
  readonly resolve: <T>(token: string) => Result<T>;
}

export const createContainer = (): Container => {
  const values = new Map<string, unknown>();
  return {
    register: (token, value) => {
      values.set(token, value);
      return ok(undefined);
    },
    resolve: <T>(token: string) => {
      if (!values.has(token)) {
        return err(platformError("DEPENDENCY_NOT_FOUND", `Dependency '${token}' was not found.`));
      }
      return ok(values.get(token) as T);
    }
  };
};
