import { Type } from "typebox";
const EMPTY_TOOL_PLUGIN_CONFIG_SCHEMA = Type.Object({}, { additionalProperties: false });
export const toolPluginMetadataSymbol = Symbol.for("openclaw.plugin-sdk.tool-plugin.metadata");
function textResult(text, details) {
    return {
        content: [{ type: "text", text }],
        details,
    };
}
function jsonResult(payload) {
    return textResult(JSON.stringify(payload, null, 2), payload);
}
function wrapToolPluginResult(result) {
    if (typeof result === "string") {
        return textResult(result, result);
    }
    return jsonResult(result);
}
function createToolPluginToolFactory() {
    return ((definition) => ({
        name: definition.name,
        label: definition.label ?? definition.name,
        description: definition.description,
        parameters: definition.parameters,
        optional: definition.optional === true,
        execute: definition.execute,
        factory: definition.factory,
    }));
}
export function defineToolPlugin(definition) {
    const configSchema = definition.configSchema ?? EMPTY_TOOL_PLUGIN_CONFIG_SCHEMA;
    const tools = [...definition.tools(createToolPluginToolFactory())];
    const activation = definition.activation ?? { onStartup: true };
    const metadata = {
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
    const entry = {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        configSchema,
        register(api) {
            const config = (api.pluginConfig ?? {});
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
export function getToolPluginMetadata(entry) {
    if (!entry || typeof entry !== "object") {
        return undefined;
    }
    const metadata = entry[toolPluginMetadataSymbol];
    if (!metadata || typeof metadata !== "object") {
        return undefined;
    }
    return metadata;
}
