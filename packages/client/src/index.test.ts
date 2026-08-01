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
});
