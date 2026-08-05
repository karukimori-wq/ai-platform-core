import { describe, expect, it } from "vitest";
import { createMemoryPromptTemplateRepository, createPromptTemplateRuntime } from "./index";

describe("prompt template runtime", () => {
  it("renders the latest template version", async () => {
    const runtime = createPromptTemplateRuntime(createMemoryPromptTemplateRepository());

    await runtime.register({ id: "report", version: 1, body: "Old {{name}}", retention: "metadata" });
    await runtime.register({ id: "report", version: 2, body: "New {{name}} {{score}}", retention: "metadata" });
    const rendered = await runtime.render({ templateId: "report", variables: { name: "A", score: 7 } });

    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    expect(rendered.value).toEqual({ templateId: "report", version: 2, rendered: "New A 7" });
  });

  it("rejects missing variables", async () => {
    const runtime = createPromptTemplateRuntime(createMemoryPromptTemplateRepository());

    await runtime.register({ id: "report", version: 1, body: "Hello {{name}}", retention: "metadata" });
    const rendered = await runtime.render({ templateId: "report", variables: {} });

    expect(rendered.ok).toBe(false);
    if (rendered.ok) return;
    expect(rendered.error.code).toBe("PROMPT_TEMPLATE_VARIABLE_MISSING");
  });
});
