import { Type, type Static, type TSchema } from "typebox";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };
type JsonObject = { [key: string]: JsonValue | undefined };
type AgentToolUpdateCallback = (update: unknown) => void;

const EMPTY_TOOL_PLUGIN_CONFIG_SCHEMA = Type.Object({}, { additionalProperties: false });

export const toolPluginMetadataSymbol = Symbol.for("openclaw.plugin-sdk.tool-plugin.metadata");

export type ToolPluginExecutionContext = {
  api: OpenClawPluginApi;
  signal?: AbortSignal;
  toolCallId: string;
  onUpdate?: AgentToolUpdateCallback;
};

type ToolPluginConfig<TConfigSchema extends TSchema | undefined> = TConfigSchema extends TSchema
  ? Static<TConfigSchema>
  : Record<string, never>;

type ToolPluginToolFactory<TConfig> = <TParamsSchema extends TSchema>(
  definition: ToolPluginToolDefinition<TConfig, TParamsSchema>,
) => DefinedToolPluginTool;

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

export type ToolPluginToolDefinition<TConfig, TParamsSchema extends TSchema> =
  ToolPluginToolDefinitionBase<TParamsSchema> & (
    | {
        execute: (params: Static<TParamsSchema>, config: TConfig, context: ToolPluginExecutionContext) => unknown;
        factory?: never;
      }
    | {
        factory: (context: ToolPluginFactoryContext<TConfig>) => AnyAgentTool | AnyAgentTool[] | null | undefined;
        execute?: never;
      }
  );

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
  registerTool: (
    tool: RegisteredTool | ((toolContext: OpenClawPluginToolContext) => AnyAgentTool | AnyAgentTool[] | null | undefined),
    options?: {
      name?: string;
      optional?: boolean;
    },
  ) => void;
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

function textResult(text: string, details: unknown): ToolResult {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

function jsonResult(payload: unknown): ToolResult {
  return textResult(JSON.stringify(payload, null, 2), payload);
}

function wrapToolPluginResult(result: unknown): ToolResult {
  if (typeof result === "string") {
    return textResult(result, result);
  }
  return jsonResult(result);
}

function createToolPluginToolFactory<TConfig>(): ToolPluginToolFactory<TConfig> {
  return ((definition) => ({
    name: definition.name,
    label: definition.label ?? definition.name,
    description: definition.description,
    parameters: definition.parameters,
    optional: definition.optional === true,
    execute: definition.execute,
    factory: definition.factory,
  })) as ToolPluginToolFactory<TConfig>;
}

export function defineToolPlugin<TConfigSchema extends TSchema | undefined = undefined>(
  definition: DefineToolPluginOptions<TConfigSchema>,
): DefinedToolPluginEntry {
  const configSchema = definition.configSchema ?? EMPTY_TOOL_PLUGIN_CONFIG_SCHEMA;
  const tools = [...definition.tools(createToolPluginToolFactory<ToolPluginConfig<TConfigSchema>>())];
  const activation = definition.activation ?? { onStartup: true };
  const metadata: ToolPluginMetadata = {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    activation,
    configSchema,
    tools: tools.map((tool) => ({
      name: tool.name,
      label: tool.label,
      description: tool.description,
      parameters: tool.parameters,
      ...(tool.optional ? { optional: true } : {}),
    })),
  };
  const entry: DefinedToolPluginEntry = {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    configSchema,
    register(api) {
      const config = (api.pluginConfig ?? {}) as ToolPluginConfig<TConfigSchema>;
      for (const tool of tools) {
        if (tool.factory) {
          api.registerTool((toolContext) => tool.factory?.({ api, config, toolContext }) ?? null, {
            name: tool.name,
            ...(tool.optional ? { optional: true } : {}),
          });
          continue;
        }
        const execute = tool.execute;
        if (!execute) {
          throw new Error(`tool plugin tool ${tool.name} must define execute or factory`);
        }
        api.registerTool({
          name: tool.name,
          label: tool.label,
          description: tool.description,
          parameters: tool.parameters,
          execute: async (toolCallId, params, signal, onUpdate) => wrapToolPluginResult(await execute(params, config, {
            api,
            signal,
            toolCallId,
            onUpdate,
          })),
        }, tool.optional ? { optional: true } : undefined);
      }
    },
    [toolPluginMetadataSymbol]: metadata,
  };
  Object.defineProperty(entry, toolPluginMetadataSymbol, {
    value: metadata,
    enumerable: false,
  });
  return entry;
}

export function getToolPluginMetadata(entry: unknown): ToolPluginMetadata | undefined {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }
  const metadata = (entry as { [toolPluginMetadataSymbol]?: unknown })[toolPluginMetadataSymbol];
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  return metadata as ToolPluginMetadata;
}
