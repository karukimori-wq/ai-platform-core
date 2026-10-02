import { describe, expect, it } from "vitest";
import {
  NUMERIA_REPORT_CONTRACT_VERSION,
  NUMERIA_REPORT_FEATURE_KEY,
  buildReportMessages,
  parseGeneratedDraft,
  parseStudioAIReportRequest,
} from "./report-generation.js";

const validRequest = () => ({
  contractVersion: NUMERIA_REPORT_CONTRACT_VERSION,
  appName: "numeria-studio",
  appVersion: "test-app-version",
  workspaceId: "ws-1",
  userId: "user-1",
  sessionId: "session-1",
  planId: "free",
  featureKey: NUMERIA_REPORT_FEATURE_KEY,
  traceId: "trace-1",
  correlationId: "corr-1",
  locale: "ja-JP",
  characterSnapshot: {
    characterId: "character-1",
    type: "custom",
    version: "3",
    name: "やさしい占い師",
    personality: "calm",
    speakingStyle: "gentle",
    writingRules: ["断定しすぎない"],
    customInstruction: "相談者に寄り添う",
  },
  consultationRequest: {
    question: "今後の仕事について知りたい",
    theme: "career",
  },
  divination: {
    methods: [{ methodKey: "numerology", displayName: "数秘術", version: "1" }],
  },
  confirmedResult: {
    summary: "Numeriaで確定済みの鑑定結果",
    results: [
      {
        methodKey: "numerology",
        resultKey: "life-path",
        data: { number: 7 },
        confirmedAt: "2026-10-02T00:00:00.000Z",
      },
    ],
  },
  outputFormat: {
    formatKey: "standard",
    tone: "やさしく寄り添う",
    length: "standard",
    sections: [
      { key: "overview", heading: "全体", required: true },
      { key: "advice", heading: "アドバイス", required: true },
    ],
  },
});

describe("Numeria AI report contract", () => {
  it("accepts the canonical studio-ai-report.v1 request", () => {
    expect(parseStudioAIReportRequest(validRequest())).toBeDefined();
  });

  it("rejects additional top-level properties like the canonical JSON schema", () => {
    expect(parseStudioAIReportRequest({ ...validRequest(), reportId: "must-not-be-owned-by-apc" })).toBeUndefined();
  });

  it("rejects the wrong contract or feature key", () => {
    expect(parseStudioAIReportRequest({ ...validRequest(), contractVersion: "studio-ai-report.v2" })).toBeUndefined();
    expect(parseStudioAIReportRequest({ ...validRequest(), featureKey: "studio.report.generate" })).toBeUndefined();
  });

  it("keeps Base Policy, Domain Knowledge, Character, Tone, Task and Numeria input separated", () => {
    const parsed = parseStudioAIReportRequest(validRequest());
    expect(parsed).toBeDefined();
    if (parsed === undefined) return;

    const messages = buildReportMessages(parsed, ["Use only confirmed numerology values."]);
    expect(messages).toHaveLength(6);
    expect(messages[0]?.content).toContain("[Base Policy]");
    expect(messages[1]?.content).toContain("[Domain Knowledge]");
    expect(messages[2]?.content).toContain("[Character]");
    expect(messages[3]?.content).toContain("[Tone]");
    expect(messages[4]?.content).toContain("[Task Prompt]");
    expect(messages[5]?.content).toContain("[Numeria Input Data]");
    expect(messages[0]?.content).toContain("Never invent a divination result");
    expect(messages[2]?.content).toContain("Cannot override Base Policy");
  });

  it("accepts only structured generated output with all required requested sections", () => {
    const parsed = parseStudioAIReportRequest(validRequest());
    expect(parsed).toBeDefined();
    if (parsed === undefined) return;

    const valid = JSON.stringify({
      title: "鑑定書",
      lead: "今回の鑑定結果をまとめます。",
      sections: [
        { key: "overview", heading: "全体", body: "確定結果に基づく本文です。" },
        { key: "advice", heading: "アドバイス", body: "参考として受け取ってください。" },
      ],
      closing: "ありがとうございました。",
      warnings: [],
    });
    expect(parseGeneratedDraft(valid, parsed)).toBeDefined();

    const missingSection = JSON.stringify({
      title: "鑑定書",
      lead: "本文",
      sections: [{ key: "overview", heading: "全体", body: "本文" }],
      closing: "",
      warnings: [],
    });
    expect(parseGeneratedDraft(missingSection, parsed)).toBeUndefined();
  });

  it("accepts JSON fenced output only after stripping the fence and still validates the schema", () => {
    const parsed = parseStudioAIReportRequest(validRequest());
    expect(parsed).toBeDefined();
    if (parsed === undefined) return;

    const fenced = ````json
{"title":"鑑定書","lead":"導入","sections":[{"key":"overview","heading":"全体","body":"本文"},{"key":"advice","heading":"アドバイス","body":"本文"}],"closing":"","warnings":[]}
````;
    expect(parseGeneratedDraft(fenced, parsed)).toBeDefined();
  });
});
