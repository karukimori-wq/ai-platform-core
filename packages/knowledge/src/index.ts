import { type Result, ok } from "@ai-platform-core/kernel";

export interface Reference {
  readonly id: string;
  readonly source: string;
  readonly title?: string;
  readonly url?: string;
}

export interface Knowledge {
  readonly id: string;
  readonly content: string;
  readonly confidence: number;
  readonly references: readonly Reference[];
  readonly lifecycle: "draft" | "active" | "archived";
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface KnowledgeSearchResult {
  readonly knowledge: Knowledge;
  readonly score: number;
}

export interface KnowledgeRepository {
  readonly save: (knowledge: Knowledge) => Promise<Result<void>>;
  readonly search: (query: string) => Promise<Result<readonly KnowledgeSearchResult[]>>;
}

export const createMemoryKnowledgeRepository = (): KnowledgeRepository => {
  const items = new Map<string, Knowledge>();
  return {
    save: async (knowledge) => {
      items.set(knowledge.id, knowledge);
      return ok(undefined);
    },
    search: async (query) => {
      const normalized = query.toLowerCase();
      return ok(
        [...items.values()]
          .filter((item) => item.lifecycle === "active")
          .map((knowledge) => ({
            knowledge,
            score: knowledge.content.toLowerCase().includes(normalized) ? 1 : 0
          }))
          .filter((result) => result.score > 0)
      );
    }
  };
};
