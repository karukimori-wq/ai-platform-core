import { describe, expect, it } from "vitest";
import { createClientRegistry } from "./index";

describe("client registry", () => {
  it("registers a client manifest and validates capability access", () => {
    const registry = createClientRegistry();
    const registered = registry.register({
      id: "sns-planner",
      name: "SNS Planner",
      type: "web",
      version: "0.1.0",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true
    });
    expect(registered.ok).toBe(true);
    expect(registry.canUseCapability("sns-planner", "SNS.Generate").ok).toBe(true);
    expect(registry.canUseCapability("sns-planner", "PDF.Export").ok).toBe(false);
  });

  it("rejects empty provider and default model values", () => {
    const registry = createClientRegistry();
    const provider = registry.register({
      id: "client-a",
      name: "Client A",
      type: "web",
      version: "0.1.0",
      provider: " ",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true
    });
    const model = registry.register({
      id: "client-b",
      name: "Client B",
      type: "web",
      version: "0.1.0",
      defaultModel: " ",
      capabilities: ["SNS.Generate"],
      knowledge: [],
      analytics: true
    });

    expect(provider.ok).toBe(false);
    expect(model.ok).toBe(false);
  });
});
