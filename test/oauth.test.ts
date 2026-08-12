import { describe, expect, it } from "vitest";
import {
  createOAuthUrl,
  getOAuthEnvironment,
  scopesForCapability,
  summarizeToken,
} from "../src/index.js";

describe("oauth helpers", () => {
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
