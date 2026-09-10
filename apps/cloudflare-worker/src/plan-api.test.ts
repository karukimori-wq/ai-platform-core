import { describe, expect, it } from "vitest";
import type { D1DatabaseLike, D1PreparedStatementLike } from "@ai-platform-core/storage";
import { getAppEntitlementDefinitions } from "./plan-api.js";
import { checkUsageAllowance, consumeUsage, getUsageSnapshot } from "./plan-usage.js";

class MemoryPreparedStatement implements D1PreparedStatementLike {
  private values: readonly unknown[] = [];

  constructor(
    private readonly query: string,
    private readonly rows: Map<string, { id: string; value_json: string; version: number; updated_at: string }>,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const namespace = String(this.values[0]);
    const id = String(this.values[1]);
    const row = this.rows.get(`${namespace}|${id}`);
    if (row === undefined) return null;
    if (this.query.includes("SELECT value_json")) return { value_json: row.value_json } as T;
    if (this.query.includes("SELECT id")) return { id: row.id } as T;
    return row as T;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: [] };
  }

  async run(): Promise<unknown> {
    const namespace = String(this.values[0]);
    const id = String(this.values[1]);
    const valueJson = String(this.values[2]);
    const version = Number(this.values[3]);
    const updatedAt = String(this.values[4]);
    const key = `${namespace}|${id}`;
    const existing = this.rows.get(key);

    if (this.query.includes("DO NOTHING") && existing !== undefined) return undefined;

    this.rows.set(key, {
      id,
      value_json: valueJson,
      version: existing === undefined ? version : existing.version + 1,
      updated_at: updatedAt,
    });
    return undefined;
  }
}

class MemoryD1 implements D1DatabaseLike {
  private readonly rows = new Map<string, { id: string; value_json: string; version: number; updated_at: string }>();

  prepare(query: string): D1PreparedStatementLike {
    return new MemoryPreparedStatement(query, this.rows);
  }
}

describe("plan API contracts", () => {
  it("exposes Numeria Studio free capabilities with monthly limits", () => {
    const features = getAppEntitlementDefinitions("numeria-studio", "free");
    expect(features).toEqual([
      {
        featureKey: "studio.report.generate",
        allowed: true,
        usagePolicy: "monthly",
        limit: 20,
      },
      {
        featureKey: "studio.report.ai_assist",
        allowed: true,
        usagePolicy: "monthly",
        limit: 20,
      },
    ]);
  });

  it("treats Pro capabilities as unlimited", () => {
    const features = getAppEntitlementDefinitions("velvet", "pro");
    expect(features).toHaveLength(3);
    expect(features.every((feature) => feature.allowed)).toBe(true);
    expect(features.every((feature) => feature.usagePolicy === "unlimited")).toBe(true);
    expect(features.every((feature) => feature.limit === null)).toBe(true);
  });

  it("keeps Business capability availability out of Free and Pro app definitions", () => {
    expect(getAppEntitlementDefinitions("numeria-studio", "free").some((feature) => feature.featureKey.startsWith("business."))).toBe(false);
    expect(getAppEntitlementDefinitions("velvet", "pro").some((feature) => feature.featureKey.startsWith("business."))).toBe(false);
  });

  it("checks usage allowance without consuming the monthly limit", async () => {
    const db = new MemoryD1();
    const request = {
      appId: "numeria-studio",
      workspaceId: "ws-test",
      userId: "user-test",
      planId: "free" as const,
      featureKey: "studio.report.ai_assist",
      activityId: "activity-test",
    };

    const checked = await checkUsageAllowance(db, request, new Date("2026-09-10T00:00:00.000Z"));
    expect(checked.allowed).toBe(true);
    expect(checked.usage.used).toBe(0);

    const afterCheck = await getUsageSnapshot(db, request, new Date("2026-09-10T00:00:00.000Z"));
    expect(afterCheck.used).toBe(0);

    const consumed = await consumeUsage(db, request, new Date("2026-09-10T00:00:00.000Z"));
    expect(consumed.allowed).toBe(true);
    expect(consumed.usage.used).toBe(1);
  });
});
