import { describe, expect, it } from "vitest";
import { getToolPluginMetadata } from "../src/openclaw-tool-plugin.js";
import plugin from "../src/index.js";

describe("plugin entrypoint", () => {
  it("exposes OpenClaw metadata for the modular tool plugin", () => {
    const metadata = getToolPluginMetadata(plugin);

    expect(metadata?.id).toBe("kai-youtube-operator");
    expect(metadata?.description).toContain("channel-manager");
    expect(metadata?.tools).toHaveLength(91);
  });
});
