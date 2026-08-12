import { describe, expect, it } from "vitest";

describe("shared types module", () => {
  it("is type-only at runtime", async () => {
    const module = await import("../src/types.js");

    expect(Object.keys(module)).toEqual([]);
  });
});
