import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { defineToolPlugin, getToolPluginMetadata } from "../src/openclaw-tool-plugin.js";

describe("openclaw tool plugin compatibility", () => {
  it("stores non-enumerable metadata for declared tools", () => {
    const plugin = defineToolPlugin({
      id: "test-plugin",
      name: "Test Plugin",
      description: "Test plugin description.",
      tools: (tool) => [
        tool({
          name: "test_echo",
          description: "Echo text.",
          parameters: Type.Object({ text: Type.String() }),
          execute: ({ text }) => ({ text }),
        }),
      ],
    });

    const metadata = getToolPluginMetadata(plugin);

    expect(metadata?.id).toBe("test-plugin");
    expect(metadata?.tools).toHaveLength(1);
    expect(Object.keys(plugin)).not.toContain("Symbol(openclaw.plugin-sdk.tool-plugin.metadata)");
  });

  it("registers tools with wrapped JSON results", async () => {
    const plugin = defineToolPlugin({
      id: "test-plugin",
      name: "Test Plugin",
      description: "Test plugin description.",
      tools: (tool) => [
        tool({
          name: "test_echo",
          description: "Echo text.",
          parameters: Type.Object({ text: Type.String() }),
          execute: ({ text }) => ({ text }),
        }),
      ],
    });
    const registered: Array<{ execute: (toolCallId: string, params: unknown) => Promise<unknown> }> = [];

    plugin.register({
      registerTool: (tool) => {
        if (typeof tool !== "function") {
          registered.push({ execute: tool.execute });
        }
      },
    });

    await expect(registered[0]?.execute("call-1", { text: "hello" })).resolves.toMatchObject({
      content: [{ type: "text", text: "{\n  \"text\": \"hello\"\n}" }],
      details: { text: "hello" },
    });
  });
});
