import type { DefineToolPluginOptions } from "openclaw/plugin-sdk/tool-plugin";
type ToolFactory = Parameters<DefineToolPluginOptions["tools"]>[0];
type ToolList = ReturnType<DefineToolPluginOptions["tools"]>;
export declare function createYoutubeTools(tool: ToolFactory): ToolList;
export {};
