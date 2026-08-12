import { describe, expect, it } from "vitest";
import {
  approvalGate,
  assertAllowedDataApiPath,
  buildAudioMixArgs,
  buildCreateBroadcastBody,
  buildGeneratedAudioArgs,
  buildLivePlan,
  buildManagerBrief,
  buildProductionChecklist,
  buildShortCreateArgs,
  buildThumbnailExtractArgs,
  buildThumbnailGenerateArgs,
  buildUploadPacketFromContent,
  buildVideoUpdateBody,
  buildVoiceoverArgs,
  createApprovalRequest,
  createDefaultManagerState,
  createOAuthUrl,
  getOAuthEnvironment,
  redactSensitive,
  resolveApprovalRequest,
  scopesForCapability,
  studioCapabilities,
  stripUndefined,
  summarizeToken,
  triageComments,
  upsertBrandKit,
  upsertContentItem,
} from "../src/index.js";

describe("Kai YouTube Operator", () => {
  it("reports OAuth environment without exposing values", () => {
    const status = getOAuthEnvironment({
      YOUTUBE_CLIENT_ID: "client-id",
      YOUTUBE_CLIENT_SECRET: "client-secret",
      YOUTUBE_REDIRECT_URI: "http://127.0.0.1:53682/oauth2callback",
    });

    expect(status.clientIdConfigured).toBe(true);
    expect(status.clientSecretConfigured).toBe(true);
    expect(JSON.stringify(status)).not.toContain("client-secret");
  });

  it("builds OAuth URLs with requested scopes and no client secret", () => {
    const result = createOAuthUrl({
      capability: "live_control",
      state: "fixed-state",
      env: {
        YOUTUBE_CLIENT_ID: "client-id",
        YOUTUBE_CLIENT_SECRET: "client-secret",
      },
    });

    expect(result.configured).toBe(true);
    expect(result.authUrl).toContain("accounts.google.com");
    expect(result.authUrl).toContain("access_type=offline");
    expect(result.authUrl).toContain("prompt=consent");
    expect(result.authUrl).toContain("state=fixed-state");
    expect(result.authUrl).toContain("youtube.force-ssl");
    expect(result.authUrl).not.toContain("client-secret");
  });

  it("returns missing config when OAuth client id is absent", () => {
    const result = createOAuthUrl({ env: {} });

    expect(result.configured).toBe(false);
    expect(result.error).toContain("YOUTUBE_CLIENT_ID");
  });

  it("selects capability scopes", () => {
    expect(scopesForCapability("analytics")).toContain("https://www.googleapis.com/auth/yt-analytics.readonly");
    expect(scopesForCapability("monetary_analytics")).toContain("https://www.googleapis.com/auth/yt-analytics-monetary.readonly");
    expect(scopesForCapability("live_control")).toEqual(["https://www.googleapis.com/auth/youtube.force-ssl"]);
  });

  it("blocks approved-only actions by default", () => {
    const gate = approvalGate(false, "going live");

    expect(gate.ok).toBe(false);
    expect(gate.blocked).toBe(true);
    expect(gate.message).toContain("approved: true");
  });

  it("allows approved actions", () => {
    expect(approvalGate(true, "going live")).toEqual({ ok: true });
  });

  it("builds safe live plans with approval checkpoints", () => {
    const plan = buildLivePlan({ goal: "go_live", title: "Test stream" });

    expect(plan.approvalRequiredBefore).toContain("transitioning a broadcast to testing, live, or complete");
    expect(plan.plan.join(" ")).toContain("stream health");
  });

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

  it("strips undefined values recursively", () => {
    expect(stripUndefined({ a: 1, b: undefined, c: { d: undefined, e: 2 } })).toEqual({
      a: 1,
      c: { e: 2 },
    });
  });

  it("redacts tokens and stream keys in nested values", () => {
    const redacted = redactSensitive({
      access_token: "abc",
      cdn: {
        ingestionInfo: {
          streamName: "secret-stream-key",
          ingestionAddress: "rtmp://example",
        },
      },
    });

    expect(redacted).toEqual({
      access_token: "[redacted]",
      cdn: {
        ingestionInfo: {
          streamName: "[redacted]",
          ingestionAddress: "[redacted]",
        },
      },
    });
  });

  it("summarizes token validity", () => {
    const summary = summarizeToken({
      access_token: "abc",
      refresh_token: "refresh",
      expiry_date: 2_000_000,
      scope: "scope-a scope-b",
    }, 1_000_000);

    expect(summary.present).toBe(true);
    expect(summary.hasRefreshToken).toBe(true);
    expect(summary.accessTokenValid).toBe(true);
    expect(summary.scopes).toEqual(["scope-a", "scope-b"]);
  });

  it("documents broad Studio API capabilities and boundaries", () => {
    const capabilities = studioCapabilities();

    expect(capabilities.apiBacked.join(" ")).toContain("Video search");
    expect(capabilities.apiBacked.join(" ")).toContain("Live stream");
    expect(capabilities.notApiBacked.join(" ")).toContain("Studio-only");
  });

  it("allowlists generic YouTube Data API paths", () => {
    expect(() => assertAllowedDataApiPath("videos")).not.toThrow();
    expect(() => assertAllowedDataApiPath("liveBroadcasts/bind")).not.toThrow();
    expect(() => assertAllowedDataApiPath("../oauth2")).toThrow("Unsupported");
    expect(() => assertAllowedDataApiPath("https://example.com")).toThrow("Unsupported");
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

  it("builds short creation ffmpeg args with explicit video mapping", () => {
    const args = buildShortCreateArgs({
      inputPath: "/tmp/source.mp4",
      outputPath: "/tmp/short.mp4",
      startTime: "00:00:05",
      durationSeconds: 30,
      topText: "Launch: now",
      fit: "pad",
    });

    expect(args).toContain("-vf");
    expect(args).toContain("0:v:0");
    expect(args.join(" ")).toContain("scale=1080:1920");
    expect(args.join(" ")).toContain("drawtext");
    expect(args.join(" ")).toContain("Launch\\: now");
  });

  it("rejects overlong short creation durations", () => {
    expect(() => buildShortCreateArgs({
      inputPath: "/tmp/source.mp4",
      outputPath: "/tmp/short.mp4",
      durationSeconds: 181,
    })).toThrow("180 seconds or less");
  });

  it("builds thumbnail extraction args", () => {
    const args = buildThumbnailExtractArgs({
      inputPath: "/tmp/source.mp4",
      outputPath: "/tmp/thumb.jpg",
      time: "00:00:10",
    });

    expect(args).toContain("-frames:v");
    expect(args).toContain("1");
    expect(args).toContain("/tmp/thumb.jpg");
  });

  it("builds generated thumbnail card args with escaped text", () => {
    const args = buildThumbnailGenerateArgs({
      outputPath: "/tmp/card.jpg",
      title: "Watch: now",
      subtitle: "New episode",
      badge: "PUBLIC",
      backgroundColor: "#111827",
    });

    expect(args).toContain("-f");
    expect(args.join(" ")).toContain("color=c=#111827");
    expect(args.join(" ")).toContain("Watch\\: now");
    expect(args).toContain("/tmp/card.jpg");
  });

  it("rejects unsafe generated thumbnail colors", () => {
    expect(() => buildThumbnailGenerateArgs({
      outputPath: "/tmp/card.jpg",
      backgroundColor: "red;rm",
    })).toThrow("Unsafe");
  });

  it("builds synthetic audio bed args", () => {
    const args = buildGeneratedAudioArgs({
      outputPath: "/tmp/bed.wav",
      durationSeconds: 12,
      style: "ambient_pad",
    });

    expect(args).toContain("-f");
    expect(args.join(" ")).toContain("lavfi");
    expect(args).toContain("pcm_s16le");
  });

  it("builds audio replacement args", () => {
    const args = buildAudioMixArgs({
      inputPath: "/tmp/in.mp4",
      audioPath: "/tmp/voice.wav",
      outputPath: "/tmp/out.mp4",
      mode: "replace",
    });

    expect(args).toContain("1:a:0");
    expect(args).toContain("-shortest");
    expect(args).toContain("/tmp/out.mp4");
  });

  it("builds voiceover args without shell composition", () => {
    const args = buildVoiceoverArgs({
      text: "Hello Kai",
      outputPath: "/tmp/voice.wav",
      voice: "en-us",
    });

    expect(args).toEqual(expect.arrayContaining(["-w", "/tmp/voice.wav", "-v", "en-us"]));
    expect(args.at(-1)).toBe("Hello Kai");
  });

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
