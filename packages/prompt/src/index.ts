import { type Result, err, ok, platformError } from "@ai-platform-core/kernel";

export interface PromptTemplate {
  readonly id: string;
  readonly version: number;
  readonly body: string;
  readonly retention: "none" | "metadata" | "rendered";
}

export interface PromptTemplateRenderRequest {
  readonly templateId: string;
  readonly version?: number;
  readonly variables: Readonly<Record<string, string | number | boolean>>;
}

export interface PromptTemplateRenderResult {
  readonly templateId: string;
  readonly version: number;
  readonly rendered: string;
}

export interface PromptTemplateRepository {
  readonly save: (template: PromptTemplate) => Promise<Result<PromptTemplate>>;
  readonly get: (id: string, version?: number) => Promise<Result<PromptTemplate>>;
  readonly list: () => Promise<Result<readonly PromptTemplate[]>>;
}

export interface PromptTemplateRuntime {
  readonly register: (template: PromptTemplate) => Promise<Result<PromptTemplate>>;
  readonly render: (request: PromptTemplateRenderRequest) => Promise<Result<PromptTemplateRenderResult>>;
}

export const createMemoryPromptTemplateRepository = (): PromptTemplateRepository => {
  const templates = new Map<string, PromptTemplate>();
  const key = (id: string, version: number): string => `${id}@${String(version)}`;
  return {
    save: async (template) => {
      templates.set(key(template.id, template.version), template);
      return ok(template);
    },
    get: async (id, version) => {
      const candidates = [...templates.values()]
        .filter((template) => template.id === id && (version === undefined || template.version === version))
        .sort((a, b) => b.version - a.version);
      const template = candidates[0];
      return template === undefined
        ? err(platformError("PROMPT_TEMPLATE_NOT_FOUND", `Prompt template '${id}' was not found.`))
        : ok(template);
    },
    list: async () => ok([...templates.values()])
  };
};

export const createPromptTemplateRuntime = (
  repository: PromptTemplateRepository
): PromptTemplateRuntime => ({
  register: async (template) => repository.save(template),
  render: async (request) => {
    const template = await repository.get(request.templateId, request.version);
    if (!template.ok) return template;
    const rendered = renderTemplateBody(template.value.body, request.variables);
    return rendered.ok
      ? ok({ templateId: template.value.id, version: template.value.version, rendered: rendered.value })
      : rendered;
  }
});

const renderTemplateBody = (
  body: string,
  variables: Readonly<Record<string, string | number | boolean>>
): Result<string> => {
  const missing = new Set<string>();
  const rendered = body.replaceAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === undefined) {
      missing.add(key);
      return "";
    }
    return String(value);
  });
  return missing.size > 0
    ? err(platformError("PROMPT_TEMPLATE_VARIABLE_MISSING", `Missing template variables: ${[...missing].join(", ")}.`))
    : ok(rendered);
};
