#!/usr/bin/env tsx
// Verify manifest.json tools[]/prompts[] match what the server actually
// registers. Drift doesn't break the server (the live list comes from
// tools/list over MCP) but it breaks discoverability in the Claude Desktop UI.
// Exits non-zero on drift so the release flow can gate on it.
//
// Tools are read by IMPORTING the registry, not by pattern-matching source.
// The previous version grepped server.ts for `tool("name")` literals, but both
// adapters register in a loop over TOOLS, so it matched nothing and the check
// failed unconditionally. Anything that can silently match zero names is a
// check that can rot into a no-op — hence the guard below.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { TOOLS } from "../src/registry.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

/** Prompts are registered with string literals, so source matching is fine. */
function promptNames(): string[] {
  const sources = [
    read("src/mcp/server.ts"),
    ...readdirSync(resolve(root, "src/mcp/prompts"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => read(`src/mcp/prompts/${f}`)),
  ].join("\n");
  const out = new Set<string>();
  for (const m of sources.matchAll(/\bregisterPrompt\(\s*"([^"]+)"/g)) {
    out.add(m[1]);
  }
  return [...out].sort();
}

interface Manifest {
  tools?: Array<{ name: string }>;
  prompts?: Array<{ name: string }>;
}

const manifest = JSON.parse(read("manifest.json")) as Manifest;

const checks = [
  {
    label: "tools",
    registered: TOOLS.map((t) => t.name).sort(),
    declared: (manifest.tools ?? []).map((t) => t.name).sort(),
  },
  {
    label: "prompts",
    registered: promptNames(),
    declared: (manifest.prompts ?? []).map((p) => p.name).sort(),
  },
];

let drift = false;

for (const { label, registered, declared } of checks) {
  // A discovery step that finds nothing is a broken check, not a passing one.
  if (registered.length === 0) {
    console.error(
      `✗ ${label}: found none registered — the check itself is broken, not the manifest.`
    );
    drift = true;
    continue;
  }
  const missing = registered.filter((n) => !declared.includes(n));
  const extra = declared.filter((n) => !registered.includes(n));
  if (missing.length || extra.length) {
    drift = true;
    console.error(`✗ ${label} out of sync:`);
    if (missing.length)
      console.error(
        `  registered, missing from manifest: ${missing.join(", ")}`
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
