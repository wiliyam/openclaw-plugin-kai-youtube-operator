import { describe, expect, it } from "vitest";
import { buildCreateBroadcastBody, buildVideoUpdateBody } from "../src/index.js";

describe("youtube request body helpers", () => {
  it("builds create broadcast bodies with private defaults", () => {
    const body = buildCreateBroadcastBody({
      title: "Demo Live",
      scheduledStartTime: "2026-08-20T10:00:00Z",
    });

    expect(body.status.privacyStatus).toBe("private");
    expect(body.status.selfDeclaredMadeForKids).toBe(false);
    expect(body.contentDetails.enableDvr).toBe(true);
    expect(JSON.stringify(body)).not.toContain("undefined");
  });

  it("builds video update bodies only for changed parts", () => {
    const update = buildVideoUpdateBody({
      id: "video-1",
      snippet: {
        title: "Old",
        description: "Old description",
        categoryId: "22",
      },
      status: {
        privacyStatus: "private",
      },
    }, {
      title: "New",
      privacyStatus: "unlisted",
    });

    expect(update.part).toBe("snippet,status");
    expect(update.body).toEqual({
      id: "video-1",
      snippet: {
        title: "New",
        description: "Old description",
        categoryId: "22",
      },
      status: {
        privacyStatus: "unlisted",
      },
    });
  });
});
