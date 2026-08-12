import { describe, expect, it } from "vitest";
import {
  approvalGate,
  buildCreateBroadcastBody,
  buildLivePlan,
  createOAuthUrl,
  getOAuthEnvironment,
  redactSensitive,
  scopesForCapability,
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
});
