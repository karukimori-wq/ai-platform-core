import { describe, expect, it } from "vitest";
import { createMemoryKeyValueStore } from "./index.js";

describe("storage", () => {
  it("stores, reads, lists, and deletes records", async () => {
    const store = createMemoryKeyValueStore<{ readonly name: string }>();
    const saved = await store.put("one", { name: "core" });
    expect(saved.ok && saved.value.version).toBe(1);
    const updated = await store.put("one", { name: "platform" });
    expect(updated.ok && updated.value.version).toBe(2);
    expect((await store.list()).ok).toBe(true);
    await store.delete("one");
    expect((await store.get("one")).ok).toBe(false);
  });
});
