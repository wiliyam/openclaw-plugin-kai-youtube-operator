import { type Static, type TSchema } from "typebox";
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue | undefined;
};
type JsonObject = {
    [key: string]: JsonValue | undefined;
};
type AgentToolUpdateCallback = (update: unknown) => void;
export declare const toolPluginMetadataSymbol: unique symbol;
export type ToolPluginExecutionContext = {
    api: OpenClawPluginApi;
    signal?: AbortSignal;
    toolCallId: string;
    onUpdate?: AgentToolUpdateCallback;
};
type ToolPluginConfig<TConfigSchema extends TSchema | undefined> = TConfigSchema extends TSchema ? Static<TConfigSchema> : Record<string, never>;
type ToolPluginToolFactory<TConfig> = <TParamsSchema extends TSchema>(definition: ToolPluginToolDefinition<TConfig, TParamsSchema>) => DefinedToolPluginTool;
export type ToolPluginFactoryContext<TConfig> = {
    api: OpenClawPluginApi;
    config: TConfig;
    toolContext: OpenClawPluginToolContext;
};
type ToolPluginToolDefinitionBase<TParamsSchema extends TSchema> = {
    name: string;
    label?: string;
    description: string;
    parameters: TParamsSchema;
    optional?: boolean;
};
export type ToolPluginToolDefinition<TConfig, TParamsSchema extends TSchema> = ToolPluginToolDefinitionBase<TParamsSchema> & ({
    execute: (params: Static<TParamsSchema>, config: TConfig, context: ToolPluginExecutionContext) => unknown;
    factory?: never;
} | {
    factory: (context: ToolPluginFactoryContext<TConfig>) => AnyAgentTool | AnyAgentTool[] | null | undefined;
    execute?: never;
});
export type ToolResult = {
    content: Array<{
        type: "text";
        text: string;
    }>;
    details: unknown;
};
export type OpenClawPluginToolContext = JsonObject;
export type AnyAgentTool = JsonObject;
export type RegisteredTool = {
    name: string;
    label: string;
    description: string;
    parameters: TSchema;
    execute: (toolCallId: string, params: unknown, signal?: AbortSignal, onUpdate?: AgentToolUpdateCallback) => Promise<ToolResult>;
};
export type OpenClawPluginApi = {
    pluginConfig?: unknown;
    registerTool: (tool: RegisteredTool | ((toolContext: OpenClawPluginToolContext) => AnyAgentTool | AnyAgentTool[] | null | undefined), options?: {
        name?: string;
        optional?: boolean;
    }) => void;
};
export type DefinedToolPluginTool = {
    name: string;
    label: string;
    description: string;
    parameters: TSchema;
    optional: boolean;
    execute?: (params: unknown, config: unknown, context: ToolPluginExecutionContext) => unknown;
    factory?: (context: ToolPluginFactoryContext<unknown>) => AnyAgentTool | AnyAgentTool[] | null | undefined;
};
export type ToolPluginStaticToolMetadata = {
    name: string;
    label: string;
    description: string;
    parameters: TSchema;
    optional?: boolean;
};
export type ToolPluginMetadata = {
    id: string;
    name: string;
    description: string;
    activation: JsonObject;
    configSchema: TSchema;
    tools: ToolPluginStaticToolMetadata[];
};
export type DefineToolPluginOptions<TConfigSchema extends TSchema | undefined = undefined> = {
    id: string;
    name: string;
    description: string;
    activation?: JsonObject;
    configSchema?: TConfigSchema;
    tools: (tool: ToolPluginToolFactory<ToolPluginConfig<TConfigSchema>>) => readonly DefinedToolPluginTool[];
};
export type DefinedToolPluginEntry = {
    id: string;
    name: string;
    description: string;
    configSchema: TSchema;
    register: (api: OpenClawPluginApi) => void;
    [toolPluginMetadataSymbol]: ToolPluginMetadata;
};
export declare function defineToolPlugin<TConfigSchema extends TSchema | undefined = undefined>(definition: DefineToolPluginOptions<TConfigSchema>): DefinedToolPluginEntry;
export declare function getToolPluginMetadata(entry: unknown): ToolPluginMetadata | undefined;
export {};
