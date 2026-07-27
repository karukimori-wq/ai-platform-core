import { describe, expect, it } from "vitest";
import { Email, Money, Percentage, createContainer, ok } from "./index.js";

describe("kernel", () => {
  it("creates result values", () => {
    expect(ok("ready")).toEqual({ ok: true, value: "ready" });
  });

  it("validates value objects", () => {
    expect(Email.create("user@example.com").ok).toBe(true);
    expect(Money.create(1000, "JPY").ok).toBe(true);
    expect(Percentage.create(101).ok).toBe(false);
  });

  it("resolves dependencies from container", () => {
    const container = createContainer();
    container.register("answer", 42);
    expect(container.resolve<number>("answer")).toEqual({ ok: true, value: 42 });
  });
});
