import type { Activity } from "@ai-platform-core/activity";
import { UUID } from "@ai-platform-core/kernel";
import { describe, expect, it } from "vitest";
import { sanitizeActivityForStorage } from "./cloudflare.js";

describe("Cloudflare Activity persistence redaction", () => {
  it("does not persist prompt context, input, provider output, or feedback memo", () => {
    const activity: Activity = {
      id: new UUID("00000000-0000-4000-8000-000000000001"),
      request: {
        client: "numeria-studio",
        workspaceId: "ws-1",
        userId: "user-1",
        capability: "studio.report.ai_assist",
        goal: "sensitive appraisal goal",
        context: { appraisalText: "sensitive appraisal body" },
        input: { consultationText: "sensitive consultation body" },
      },
      status: "completed",
      result: {
        activityId: "00000000-0000-4000-8000-000000000001",
        output: { text: "sensitive generated report" },
        provider: "openai",
        model: "test-model",
        tokens: { input: 10, output: 20, total: 30 },
        cost: { amount: 0, currency: "USD" },
        latencyMs: 100,
        knowledgeUsed: [],
      },
      feedback: {
        activityId: "00000000-0000-4000-8000-000000000001",
        rating: 5,
        edited: false,
        accepted: true,
        memo: "sensitive feedback memo",
      },
      createdAt: new Date("2026-09-12T00:00:00.000Z"),
      updatedAt: new Date("2026-09-12T00:00:01.000Z"),
    };

    const stored = sanitizeActivityForStorage(activity);
    const serialized = JSON.stringify(stored);

    expect(stored.request.goal).toBe("studio.report.ai_assist");
    expect(stored.request.context).toEqual({});
    expect(stored.request.input).toEqual({});
    expect(stored.result?.output).toEqual({});
    expect(stored.feedback).not.toHaveProperty("memo");
    expect(serialized).not.toContain("sensitive appraisal goal");
    expect(serialized).not.toContain("sensitive appraisal body");
    expect(serialized).not.toContain("sensitive consultation body");
    expect(serialized).not.toContain("sensitive generated report");
    expect(serialized).not.toContain("sensitive feedback memo");
    expect(serialized).toContain("numeria-studio");
    expect(serialized).toContain("studio.report.ai_assist");
  });
});
