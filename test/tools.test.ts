import { describe, expect, it } from "vitest";
import type { DefineToolPluginOptions } from "openclaw/plugin-sdk/tool-plugin";
import { createYoutubeTools } from "../src/tools.js";

type ToolFactory = Parameters<DefineToolPluginOptions["tools"]>[0];

const collectTool: ToolFactory = ((definition) => ({
  name: definition.name,
  label: definition.label ?? definition.name,
  description: definition.description,
  parameters: definition.parameters,
  optional: definition.optional ?? false,
  execute: "execute" in definition ? definition.execute : undefined,
  factory: "factory" in definition ? definition.factory : undefined,
})) as ToolFactory;

describe("tool registry", () => {
  it("registers the full modular YouTube tool catalog", () => {
    const tools = createYoutubeTools(collectTool);
    const names = tools.map((item) => item.name);

    expect(tools).toHaveLength(91);
    expect(new Set(names).size).toBe(tools.length);
    expect(names).toContain("kai_youtube_manager_status");
    expect(names).toContain("kai_youtube_video_upload_public");
    expect(names).toContain("kai_youtube_live_super_chats");
  });
});
