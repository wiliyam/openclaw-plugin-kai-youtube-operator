import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "src");
const testDir = path.join(root, "test");
const scriptDir = path.join(root, "scripts");

const sourceFiles = (await readdir(sourceDir)).filter((file) => file.endsWith(".ts")).sort();
const testFiles = (await readdir(testDir)).filter((file) => file.endsWith(".test.ts")).sort();
const failures = [];

function fail(message) {
  failures.push(message);
}

async function readProjectFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

for (const file of sourceFiles) {
  const sourcePath = path.join(sourceDir, file);
  if (file.endsWith(".test.ts")) {
    fail(`Runtime source must not contain tests: src/${file}`);
  }
  const moduleName = file.replace(/\.ts$/, "");
  const expectedTest = `${moduleName}.test.ts`;
  if (!testFiles.includes(expectedTest)) {
    fail(`Missing module test file: test/${expectedTest}`);
  }

  const source = await readFile(sourcePath, "utf8");
  if (/\bany\b|Type\.Any|as any|Record<string,\s*any>|unknown as/.test(source)) {
    fail(`Loose type pattern found in src/${file}`);
  }
}

for (const file of testFiles) {
  const test = await readFile(path.join(testDir, file), "utf8");
  if (/\bany\b|Type\.Any|as any|Record<string,\s*any>|unknown as/.test(test)) {
    fail(`Loose type pattern found in test/${file}`);
  }
}

const toolsSource = await readProjectFile("src/tools.ts");
const manifest = JSON.parse(await readProjectFile("openclaw.plugin.json"));
const sourceToolNames = [...new Set([...toolsSource.matchAll(/name: "(kai_youtube_[^"]+)"/g)].map((match) => match[1]))].sort();
const manifestToolNames = [...manifest.contracts.tools].sort();
const missingFromManifest = sourceToolNames.filter((name) => !manifestToolNames.includes(name));
const extraInManifest = manifestToolNames.filter((name) => !sourceToolNames.includes(name));

if (sourceToolNames.length !== 91 || manifestToolNames.length !== 91) {
  fail(`Expected 91 YouTube tools, found source=${sourceToolNames.length} manifest=${manifestToolNames.length}`);
}
if (missingFromManifest.length > 0) {
  fail(`Tools missing from manifest: ${missingFromManifest.join(", ")}`);
}
if (extraInManifest.length > 0) {
  fail(`Manifest has extra tools: ${extraInManifest.join(", ")}`);
}

const sensitivePattern = new RegExp([
  "GOC" + "SPX",
  "AAE" + "wrE9",
  "oauth2callback\\?co" + "de",
  "4\\/0" + "AX",
  "192\\.9" + "\\.166\\.69",
].join("|"));
const scanRoots = [
  "src",
  "test",
  "scripts",
  ".github",
  ".githooks",
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "skills/kai-youtube-operator/SKILL.md",
  "openclaw.plugin.json",
  "package.json",
  "package-lock.json",
];

async function scanPath(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const info = await stat(absolutePath);
  if (info.isDirectory()) {
    for (const child of await readdir(absolutePath)) {
      await scanPath(path.join(relativePath, child));
    }
    return;
  }
  const text = await readFile(absolutePath, "utf8");
  if (sensitivePattern.test(text)) {
    fail(`Known sensitive value pattern found in ${relativePath}`);
  }
}

for (const target of scanRoots) {
  await scanPath(target);
}

const scriptFiles = await readdir(scriptDir).catch(() => []);
if (!scriptFiles.includes("check-quality.mjs")) {
  fail("Missing scripts/check-quality.mjs");
}

if (failures.length > 0) {
  console.error(failures.map((message) => `- ${message}`).join("\n"));
  process.exit(1);
}

console.log("Quality checks passed.");
