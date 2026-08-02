export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

export interface Repository<T> {
  readonly save: (item: T) => Promise<void>;
  readonly findById: (id: string) => Promise<T | undefined>;
}
