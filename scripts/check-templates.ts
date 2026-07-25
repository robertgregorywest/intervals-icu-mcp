#!/usr/bin/env tsx
/**
 * Parse every templates/workouts/*.md and diff its rendered body against the pre-rewrite
 * baseline (tests/fixtures/render-baseline.txt). Templates absent from the
 * baseline, or listed as deliberate diffs, are reported rather than failed.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTemplate } from "../src/services/workout-library/template.js";
import { renderBody } from "../src/services/workout-library/render.js";

const MAP_WATTS = 415;
const FTP_WATTS = 290;
const EXPECTED_DIFFS = new Set([
  "map-ramp-test",
  "vo2-preloaded-shorts",
  // Step label "Z2" was read by Intervals.icu as a zone token, not text, so the
  // label was silently dropped. Renamed to "Endurance".
  "z2-endurance-2h",
]);

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(here, "../templates/workouts");
const baselinePath = resolve(here, "../tests/fixtures/render-baseline.txt");

function loadBaseline(): Map<string, string> {
  const text = readFileSync(baselinePath, "utf8");
  const out = new Map<string, string>();
  for (const block of text.split("=".repeat(72))) {
    const seedId = block.match(/^\s*seedId:\s*(\S+)/m)?.[1];
    if (!seedId) continue;
    const sep = "-".repeat(72);
    const idx = block.indexOf(sep);
    if (idx === -1) continue;
    out.set(
      seedId,
      block
        .slice(idx + sep.length)
        .replace(/^\n/, "")
        .trimEnd()
    );
  }
  return out;
}

function main() {
  const baseline = loadBaseline();
  const showIdx = process.argv.indexOf("--show");
  const showing = showIdx === -1 ? null : process.argv[showIdx + 1];
  const files = readdirSync(templatesDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  let identical = 0;
  let expected = 0;
  let unexpected = 0;
  let novel = 0;

  for (const file of files) {
    const source = readFileSync(join(templatesDir, file), "utf8");
    const template = parseTemplate(source, `templates/workouts/${file}`);
    const body = renderBody(template, {
      mapWatts: MAP_WATTS,
      ftpWatts: FTP_WATTS,
    });
    const before = baseline.get(template.seedId);

    if (showing && template.seedId === showing) {
      console.log(body);
      return;
    }

    if (before === undefined) {
      console.log(`NEW       ${template.seedId} (not in baseline)`);
      novel++;
      continue;
    }
    if (before === body) {
      console.log(`identical ${template.seedId}`);
      identical++;
      continue;
    }
    if (EXPECTED_DIFFS.has(template.seedId)) {
      console.log(`DIFF (expected) ${template.seedId}`);
      expected++;
      continue;
    }
    unexpected++;
    console.log(`\nDIFF (UNEXPECTED) ${template.seedId}`);
    console.log("--- baseline ---");
    console.log(before);
    console.log("--- rendered ---");
    console.log(body);
    console.log("");
  }

  console.log(
    `\n${files.length} template(s): ${identical} identical, ${expected} expected diff, ${novel} new, ${unexpected} UNEXPECTED`
  );
  const missing = [...baseline.keys()].filter(
    (id) =>
      !files.some((f) =>
        readFileSync(join(templatesDir, f), "utf8").includes(`seedId: ${id}\n`)
      )
  );
  if (missing.length) console.log(`not yet ported: ${missing.join(", ")}`);
  if (unexpected > 0) process.exit(1);
}

main();
