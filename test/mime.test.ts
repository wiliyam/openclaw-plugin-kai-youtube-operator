import { describe, expect, it } from "vitest";
import { inferMimeType } from "../src/index.js";

describe("mime helpers", () => {
  it("infers common YouTube media MIME types", () => {
    expect(inferMimeType("/tmp/video.mp4")).toBe("video/mp4");
    expect(inferMimeType("/tmp/thumb.webp")).toBe("image/webp");
    expect(inferMimeType("/tmp/captions.vtt")).toBe("text/vtt");
    expect(inferMimeType("/tmp/archive.bin")).toBe("application/octet-stream");
  });
});
