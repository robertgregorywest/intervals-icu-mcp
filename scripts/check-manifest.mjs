#!/usr/bin/env node
// Verify manifest.json tools[]/prompts[] match what the server actually
// registers. Drift doesn't break the server (the live list comes from
// tools/list over MCP) but it breaks discoverability in the Claude Desktop UI.
// Exits non-zero on drift so the release flow can gate on it.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8");
}

function namesFrom(source, fnName) {
  // Registrations span newlines, e.g. tool(\n    "name", — so match across them.
  const re = new RegExp(`\\b${fnName}\\(\\s*"([^"]+)"`, "g");
  const out = new Set();
  for (const m of source.matchAll(re)) out.add(m[1]);
  return [...out].sort();
}

const server = read("src/mcp/server.ts");
const promptFiles = readdirSync(resolve(root, "src/mcp/prompts"))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => read(`src/mcp/prompts/${f}`));
const promptSources = [server, ...promptFiles].join("\n");

const manifest = JSON.parse(read("manifest.json"));

const checks = [
  {
    label: "tools",
    registered: namesFrom(server, "tool"),
    declared: (manifest.tools ?? []).map((t) => t.name).sort(),
  },
  {
    label: "prompts",
    registered: namesFrom(promptSources, "registerPrompt"),
    declared: (manifest.prompts ?? []).map((p) => p.name).sort(),
  },
];

let drift = false;
for (const { label, registered, declared } of checks) {
  const missing = registered.filter((n) => !declared.includes(n));
  const extra = declared.filter((n) => !registered.includes(n));
  if (missing.length || extra.length) {
    drift = true;
    console.error(`✗ ${label} out of sync:`);
    if (missing.length)
      console.error(
        `  in server, missing from manifest: ${missing.join(", ")}`
      );
    if (extra.length)
      console.error(`  in manifest, not registered: ${extra.join(", ")}`);
  } else {
    console.error(`✓ ${label} in sync (${registered.length})`);
  }
}

if (drift) {
  console.error(
    "\nUpdate manifest.json before tagging. " +
      "Each tools[] entry is { name }; each prompts[] entry needs name, description, text."
  );
  process.exit(1);
}
console.error("\nManifest in sync.");
