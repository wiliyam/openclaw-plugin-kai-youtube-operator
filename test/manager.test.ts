import { describe, expect, it } from "vitest";
import {
  buildManagerBrief,
  buildProductionChecklist,
  buildUploadPacketFromContent,
  createApprovalRequest,
  createDefaultManagerState,
  resolveApprovalRequest,
  triageComments,
  upsertBrandKit,
  upsertContentItem,
} from "../src/index.js";

describe("channel manager helpers", () => {
  it("creates a safe default channel manager state", () => {
    const state = createDefaultManagerState("2026-08-12T00:00:00.000Z");

    expect(state.version).toBe(1);
    expect(state.brandKit.uploadDefaults.privacyStatus).toBe("private");
    expect(state.contentItems).toEqual([]);
    expect(state.approvals).toEqual([]);
    expect(state.commentRules.escalationKeywords).toContain("sponsor");
  });

  it("merges brand kit updates without dropping defaults", () => {
    const state = createDefaultManagerState("2026-08-12T00:00:00.000Z");
    const updated = upsertBrandKit(state, {
      channelName: "GhostDistrict",
      defaultHashtags: ["#ghostdistrict", "#shorts"],
      uploadDefaults: {
        privacyStatus: "unlisted",
        categoryId: "24",
      },
    }, "2026-08-12T01:00:00.000Z");

    expect(updated.brandKit.channelName).toBe("GhostDistrict");
    expect(updated.brandKit.defaultHashtags).toEqual(["#ghostdistrict", "#shorts"]);
    expect(updated.brandKit.uploadDefaults.privacyStatus).toBe("unlisted");
    expect(updated.brandKit.uploadDefaults.selfDeclaredMadeForKids).toBe(false);
    expect(updated.updatedAt).toBe("2026-08-12T01:00:00.000Z");
  });

  it("upserts content items and keeps stable ids", () => {
    const state = createDefaultManagerState("2026-08-12T00:00:00.000Z");
    const first = upsertContentItem(state, {
      id: "video-idea",
      title: "First idea",
      format: "long",
      status: "idea",
    }, "2026-08-12T01:00:00.000Z");
    const second = upsertContentItem(first.state, {
      id: "video-idea",
      status: "editing",
      notes: "Rough cut started.",
    }, "2026-08-12T02:00:00.000Z");

    expect(first.item.id).toBe("video-idea");
    expect(second.state.contentItems).toHaveLength(1);
    expect(second.item.title).toBe("First idea");
    expect(second.item.status).toBe("editing");
    expect(second.item.notes).toBe("Rough cut started.");
  });

  it("builds upload packets from brand defaults and content", () => {
    const state = upsertContentItem(upsertBrandKit(createDefaultManagerState("2026-08-12T00:00:00.000Z"), {
      defaultHashtags: ["#ghostdistrict"],
      defaultTags: ["horror", "story"],
      descriptionTemplate: "{{summary}}\n\nWatch more: {{playlistUrl}}\n{{hashtags}}",
      uploadDefaults: {
        privacyStatus: "private",
        categoryId: "24",
      },
    }, "2026-08-12T00:10:00.000Z"), {
      id: "short-1",
      title: "A Shadow at the Door",
      format: "short",
      status: "ready",
      summary: "A 30 second horror short.",
      playlistUrl: "https://youtube.com/playlist?list=demo",
      tags: ["shorts"],
      thumbnailPath: "/tmp/thumb.jpg",
      outputPaths: ["/tmp/short.mp4"],
    }, "2026-08-12T00:20:00.000Z").state;

    const packet = buildUploadPacketFromContent(state, "short-1", {
      titleVariants: ["A Shadow at the Door #Shorts"],
      pinnedComment: "What would you do?",
    });

    expect(packet.title).toBe("A Shadow at the Door #Shorts");
    expect(packet.description).toContain("A 30 second horror short.");
    expect(packet.description).toContain("#ghostdistrict");
    expect(packet.tags).toEqual(["horror", "story", "shorts"]);
    expect(packet.filePath).toBe("/tmp/short.mp4");
    expect(packet.thumbnailPath).toBe("/tmp/thumb.jpg");
    expect(packet.privacyStatus).toBe("private");
  });

  it("creates and resolves approval requests immutably", () => {
    const state = createDefaultManagerState("2026-08-12T00:00:00.000Z");
    const created = createApprovalRequest(state, {
      id: "approval-1",
      action: "publish",
      targetType: "video",
      targetId: "abc123",
      summary: "Make abc123 public.",
    }, "2026-08-12T01:00:00.000Z");
    const resolved = resolveApprovalRequest(created.state, "approval-1", "approved", "wiliyam", "2026-08-12T02:00:00.000Z");

    expect(created.request.status).toBe("pending");
    expect(resolved.request.status).toBe("approved");
    expect(resolved.state.auditLog.at(-1)?.action).toBe("approval.approved");
  });

  it("triages comments with configured escalation and spam rules", () => {
    const state = upsertBrandKit(createDefaultManagerState("2026-08-12T00:00:00.000Z"), {
      voice: "Calm, concise, helpful.",
    }, "2026-08-12T00:10:00.000Z");
    const result = triageComments(state, [
      { id: "c1", author: "A", text: "Great video!" },
      { id: "c2", author: "B", text: "Sponsor question, please email me." },
      { id: "c3", author: "C", text: "Buy followers now" },
    ]);

    expect(result[0].recommendedAction).toBe("reply");
    expect(result[1].recommendedAction).toBe("escalate");
    expect(result[2].recommendedAction).toBe("hide_or_review");
  });

  it("builds production checklists with approval checkpoints", () => {
    const state = upsertContentItem(createDefaultManagerState("2026-08-12T00:00:00.000Z"), {
      id: "live-1",
      title: "Launch stream",
      format: "live",
      status: "ready",
    }, "2026-08-12T01:00:00.000Z").state;
    const checklist = buildProductionChecklist(state, "live-1");

    expect(checklist.title).toBe("Launch stream");
    expect(checklist.checkpoints).toContain("Confirm explicit approval before going live or publishing.");
    expect(checklist.missing).toContain("scheduledFor");
  });

  it("builds manager briefs with ready items and approvals", () => {
    let state = createDefaultManagerState("2026-08-12T00:00:00.000Z");
    state = upsertContentItem(state, {
      id: "ready-1",
      title: "Ready Short",
      format: "short",
      status: "ready",
    }, "2026-08-12T01:00:00.000Z").state;
    state = createApprovalRequest(state, {
      id: "approval-1",
      action: "upload",
      targetType: "content",
      targetId: "ready-1",
      summary: "Upload Ready Short privately.",
    }, "2026-08-12T02:00:00.000Z").state;

    const brief = buildManagerBrief(state, "2026-08-12T03:00:00.000Z");

    expect(brief.readyToPublish).toHaveLength(1);
    expect(brief.pendingApprovals).toHaveLength(1);
    expect(brief.nextActions.join(" ")).toContain("approval");
  });
});
