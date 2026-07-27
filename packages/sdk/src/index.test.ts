import { describe, expect, it } from "vitest";
import { Email, createPlatformRuntime } from "./index.js";

describe("sdk", () => {
  it("exports public API", () => {
    expect(Email.create("user@example.com").ok).toBe(true);
    expect(createPlatformRuntime().clock.now()).toBeInstanceOf(Date);
  });
});
