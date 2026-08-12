import { describe, expect, it } from "vitest";
import {
  approvalGate,
  assertAllowedDataApiPath,
  redactSensitive,
  stripUndefined,
} from "../src/index.js";

describe("safety helpers", () => {
  it("blocks approved-only actions by default", () => {
    const gate = approvalGate(false, "going live");

    expect(gate.ok).toBe(false);
    expect(gate.blocked).toBe(true);
    expect(gate.message).toContain("approved: true");
  });

  it("allows approved actions", () => {
    expect(approvalGate(true, "going live")).toEqual({ ok: true });
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

  it("allowlists generic YouTube Data API paths", () => {
    expect(() => assertAllowedDataApiPath("videos")).not.toThrow();
    expect(() => assertAllowedDataApiPath("liveBroadcasts/bind")).not.toThrow();
    expect(() => assertAllowedDataApiPath("../oauth2")).toThrow("Unsupported");
    expect(() => assertAllowedDataApiPath("https://example.com")).toThrow("Unsupported");
  });
});
