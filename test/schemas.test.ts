import { describe, expect, it } from "vitest";
import { JsonObjectSchema } from "../src/schemas.js";

describe("schemas", () => {
  it("uses unknown for generic JSON object values", () => {
    const schema = JsonObjectSchema as Record<string, unknown>;

    expect(schema.type).toBe("object");
    expect(schema.patternProperties).toEqual({ "^.*$": {} });
  });
});
