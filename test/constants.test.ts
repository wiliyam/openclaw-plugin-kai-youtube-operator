import { describe, expect, it } from "vitest";
import {
  MAX_SHORT_DURATION_SECONDS,
  YOUTUBE_SCOPES,
} from "../src/constants.js";

describe("constants", () => {
  it("keeps shorts and OAuth scope constants explicit", () => {
    expect(MAX_SHORT_DURATION_SECONDS).toBe(180);
    expect(YOUTUBE_SCOPES.full_channel).toContain("https://www.googleapis.com/auth/youtube.upload");
    expect(YOUTUBE_SCOPES.monetary_analytics).toContain("https://www.googleapis.com/auth/yt-analytics-monetary.readonly");
  });
});
