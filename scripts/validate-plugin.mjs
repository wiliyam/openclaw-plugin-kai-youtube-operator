import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function stableJson(value) {
  return JSON.stringify(value);
}

const packageJson = await readJson("package.json");
const manifest = await readJson("openclaw.plugin.json");

await access(path.join(root, "dist/index.js")).catch(() => fail("Missing built entrypoint: dist/index.js"));
const entryModule = await import(pathToFileURL(path.join(root, "dist/index.js")).href);
const helperModule = await import(pathToFileURL(path.join(root, "dist/openclaw-tool-plugin.js")).href);
const metadata = helperModule.getToolPluginMetadata(entryModule.default);

if (!metadata) {
  fail("Built plugin entrypoint does not expose tool metadata.");
}

if (!packageJson.openclaw?.extensions?.includes("./dist/index.js")) {
  fail("package.json must advertise ./dist/index.js in openclaw.extensions.");
}

if (manifest.version !== packageJson.version) {
  fail(`Manifest version ${manifest.version} does not match package version ${packageJson.version}.`);
}

if (metadata) {
  for (const key of ["id", "name", "description"]) {
    if (manifest[key] !== metadata[key]) {
      fail(`Manifest ${key} does not match built metadata.`);
    }
  }

  if (stableJson(manifest.activation) !== stableJson(metadata.activation)) {
    fail("Manifest activation does not match built metadata.");
  }
  if (stableJson(manifest.configSchema) !== stableJson(metadata.configSchema)) {
    fail("Manifest configSchema does not match built metadata.");
  }

  const metadataTools = metadata.tools.map((tool) => tool.name);
  const manifestTools = manifest.contracts?.tools ?? [];
  const sortedMetadataTools = [...metadataTools].sort();
  const sortedManifestTools = [...manifestTools].sort();

  if (metadataTools.length !== 91) {
    fail(`Expected 91 built tools, found ${metadataTools.length}.`);
  }
  if (new Set(metadataTools).size !== metadataTools.length) {
    fail("Built tool names must be unique.");
  }
  if (stableJson(sortedMetadataTools) !== stableJson(sortedManifestTools)) {
    fail("Manifest tool contract does not match built metadata.");
  }

  for (const tool of metadata.tools) {
    if (!tool.name.startsWith("kai_youtube_")) {
      fail(`Tool name must use kai_youtube_ prefix: ${tool.name}`);
    }
    if (!tool.description.trim()) {
      fail(`Tool must have a description: ${tool.name}`);
    }
    if (!tool.parameters || typeof tool.parameters !== "object") {
      fail(`Tool must have a parameter schema: ${tool.name}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.map((message) => `- ${message}`).join("\n"));
  process.exit(1);
}

console.log("Plugin contract validation passed.");
