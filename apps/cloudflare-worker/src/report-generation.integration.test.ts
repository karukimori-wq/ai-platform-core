import { describe, expect, it } from "vitest";
import type { ActivityRepository } from "@ai-platform-core/activity";
import { createMemoryActivityRepository } from "@ai-platform-core/activity";
import type { AIProvider } from "@ai-platform-core/provider";
import { createPlatformRuntime } from "@ai-platform-core/runtime";
import type { D1DatabaseLike, D1PreparedStatementLike } from "@ai-platform-core/storage";
import { getUsageSnapshot } from "./plan-usage.js";
import {
  handleStudioAIReportGeneration,
  NUMERIA_REPORT_CONTRACT_VERSION,
  NUMERIA_REPORT_FEATURE_KEY,
} from "./report-generation.js";

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

const requestBody = () => ({
  contractVersion: NUMERIA_REPORT_CONTRACT_VERSION,
  appName: "numeria-studio",
  appVersion: "integration-test",
  workspaceId: "ws-report",
  userId: "user-report",
  sessionId: "session-report",
  planId: "free",
  featureKey: NUMERIA_REPORT_FEATURE_KEY,
  traceId: "trace-report",
  correlationId: "corr-report",
  locale: "ja-JP",
  characterSnapshot: {
    characterId: "gentle",
    type: "custom",
    version: "1",
    name: "やさしい占い師",
    personality: "calm",
    speakingStyle: "gentle",
    writingRules: ["断定しすぎない"],
    customInstruction: "相談者に寄り添う",
  },
  consultationRequest: {
    question: "仕事について",
    theme: "career",
  },
  divination: {
    methods: [{ methodKey: "numerology", displayName: "数秘術", version: "1" }],
  },
  confirmedResult: {
    summary: "ライフパス7として確定済み",
    results: [{ methodKey: "numerology", resultKey: "life-path", data: { number: 7 } }],
  },
  outputFormat: {
    formatKey: "standard",
    tone: "やさしく寄り添う",
    length: "short",
    sections: [
      { key: "overview", heading: "鑑定結果", required: true },
      { key: "advice", heading: "これからのヒント", required: true },
    ],
  },
});

const makeRequest = () =>
  new Request("https://apc.test/api/v1/generations/report", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": "numeria-studio",
      "x-app-version": "integration-test",
      "x-workspace-id": "ws-report",
      "x-user-id": "user-report",
      "x-trace-id": "trace-report",
    },
    body: JSON.stringify(requestBody()),
  });

const validDraft = JSON.stringify({
  title: "鑑定書",
  lead: "確定済みの結果をもとにお伝えします。",
  sections: [
    { key: "overview", heading: "鑑定結果", body: "ライフパス7の結果を文章化します。", warnings: [] },
    { key: "advice", heading: "これからのヒント", body: "未来を断定せず参考としてお伝えします。", warnings: [] },
  ],
  closing: "参考として受け取ってください。",
  warnings: [],
});

const provider = (text: string): AIProvider => ({
  id: "openai",
  chat: async (request) => ({
    ok: true,
    value: {
      output: { text },
      text,
      model: request.model,
      tokens: { input: 100, output: 80, total: 180 },
      cost: { amount: 0.001, currency: "USD" },
      knowledgeUsed: [],
    },
  }),
});

const createTestRuntime = (text: string, activities: ActivityRepository) => {
  const runtime = createPlatformRuntime({ activityRepository: activities });
  runtime.clients.register({
    id: "numeria-studio",
    name: "Numeria Studio",
    type: "api",
    version: "1",
    provider: "openai",
    defaultModel: "test-model",
    capabilities: [NUMERIA_REPORT_FEATURE_KEY],
    knowledge: [],
    analytics: true,
  });
  runtime.providers.register(provider(text));
  return runtime;
};

describe("Numeria report generation orchestration", () => {
  it("records Activity and both Usage layers only after a valid structured draft", async () => {
    const db = new MemoryD1();
    const activities = createMemoryActivityRepository();
    const runtime = createTestRuntime(validDraft, activities);

    const result = await handleStudioAIReportGeneration(makeRequest(), {
      runtime,
      db,
      id: () => "generation-1",
      now: () => new Date("2026-10-02T04:00:00.000Z"),
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      status: "success",
      generationId: "generation-1",
      traceId: "trace-report",
      correlationId: "corr-report",
      promptKey: "numeria.report.generate.structured",
      promptVersion: "1.0.0",
      model: { provider: "openai", modelId: "test-model" },
      usage: { usageRecorded: true, usageCount: 1, limit: null, overLimit: false },
    });

    const activityList = await activities.list();
    expect(activityList.ok).toBe(true);
    if (activityList.ok) {
      expect(activityList.value).toHaveLength(1);
      expect(activityList.value[0]?.status).toBe("completed");
      expect(activityList.value[0]?.request.context).toMatchObject({
        generationId: "generation-1",
        correlationId: "corr-report",
        traceId: "trace-report",
      });
    }

    const analytics = await runtime.analytics.listUsage();
    expect(analytics.ok).toBe(true);
    if (analytics.ok) {
      expect(analytics.value).toHaveLength(1);
      expect(analytics.value[0]).toMatchObject({
        client: "numeria-studio",
        capability: NUMERIA_REPORT_FEATURE_KEY,
        totalTokens: 180,
      });
    }

    const planUsage = await getUsageSnapshot(
      db,
      {
        appId: "numeria-studio",
        appVersion: "integration-test",
        workspaceId: "ws-report",
        userId: "user-report",
        planId: "free",
        featureKey: NUMERIA_REPORT_FEATURE_KEY,
      },
      new Date("2026-10-02T04:00:00.000Z"),
    );
    expect(planUsage.usageCount).toBe(1);
  });

  it("returns OUTPUT_SCHEMA_INVALID and records no Activity or Usage for malformed AI output", async () => {
    const db = new MemoryD1();
    const activities = createMemoryActivityRepository();
    const runtime = createTestRuntime('{"title":"missing required fields"}', activities);

    const result = await handleStudioAIReportGeneration(makeRequest(), {
      runtime,
      db,
      id: () => "generation-invalid",
      now: () => new Date("2026-10-02T04:00:00.000Z"),
    });

    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({
      status: "error",
      generationId: "generation-invalid",
      error: { code: "OUTPUT_SCHEMA_INVALID" },
    });

    const activityList = await activities.list();
    expect(activityList.ok).toBe(true);
    if (activityList.ok) expect(activityList.value).toHaveLength(0);

    const analytics = await runtime.analytics.listUsage();
    expect(analytics.ok).toBe(true);
    if (analytics.ok) expect(analytics.value).toHaveLength(0);

    const planUsage = await getUsageSnapshot(
      db,
      {
        appId: "numeria-studio",
        appVersion: "integration-test",
        workspaceId: "ws-report",
        userId: "user-report",
        planId: "free",
        featureKey: NUMERIA_REPORT_FEATURE_KEY,
      },
      new Date("2026-10-02T04:00:00.000Z"),
    );
    expect(planUsage.usageCount).toBe(0);
  });
});
