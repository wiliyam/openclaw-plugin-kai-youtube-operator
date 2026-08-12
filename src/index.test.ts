import { describe, expect, it } from "vitest";
import {
  approvalGate,
  assertAllowedDataApiPath,
  buildAudioMixArgs,
  buildCreateBroadcastBody,
  buildGeneratedAudioArgs,
  buildLivePlan,
  buildShortCreateArgs,
  buildThumbnailExtractArgs,
  buildThumbnailGenerateArgs,
  buildVideoUpdateBody,
  buildVoiceoverArgs,
  createOAuthUrl,
  getOAuthEnvironment,
  redactSensitive,
  scopesForCapability,
  studioCapabilities,
  stripUndefined,
  summarizeToken,
} from "./index";

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
});
