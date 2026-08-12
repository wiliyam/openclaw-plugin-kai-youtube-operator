import { describe, expect, it } from "vitest";
import { queryString } from "../src/api.js";

describe("api helpers", () => {
  it("serializes defined query parameters only", () => {
    expect(queryString({
      part: "snippet",
      maxResults: 10,
      mine: true,
      pageToken: undefined,
    })).toBe("part=snippet&maxResults=10&mine=true");
  });
});
