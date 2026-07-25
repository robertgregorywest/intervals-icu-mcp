import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadTemplates } from "../../../src/services/workout-library/loader.js";
import { renderBody } from "../../../src/services/workout-library/render.js";

/**
 * The shipped templates, checked against the render captured from
 * CANONICAL_TEMPLATES immediately before the ADR 0005 rewrite.
 *
 * Everything must reproduce that output byte-for-byte except the entries below,
 * which changed by explicit decision. If a diff appears here that isn't listed,
 * a template edit has silently changed a workout the athlete rides.
 */
const MAP_WATTS = 415;
const FTP_WATTS = 290;

const EXPECTED_DIFFS: Record<string, string> = {
  "map-ramp-test":
    "rewritten as a fixed literal-watt protocol for retest comparability",
  "vo2-preloaded-shorts":
    "expressed as a clean 12x nest, adding one trailing 15s Off",
  "z2-endurance-2h":
    'step label "Z2" was eaten by Intervals.icu as a zone token; renamed to "Endurance"',
};

function loadBaseline(): Map<string, string> {
  const text = readFileSync(
    resolve(import.meta.dirname, "../../fixtures/render-baseline.txt"),
    "utf8"
  );
  const out = new Map<string, string>();
  for (const block of text.split("=".repeat(72))) {
    const seedId = block.match(/^\s*seedId:\s*(\S+)/m)?.[1];
    const sep = "-".repeat(72);
    const idx = block.indexOf(sep);
    if (!seedId || idx === -1) continue;
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

const templates = loadTemplates();
const baseline = loadBaseline();

describe("shipped templates", () => {
  it("all parse", () => {
    expect(templates.length).toBeGreaterThan(0);
  });

  it("every template has a purpose", () => {
    for (const t of templates) {
      expect(t.purpose.trim(), `${t.seedId} purpose`).not.toBe("");
    }
  });

  it("seedIds are unique", () => {
    const ids = templates.map((t) => t.seedId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every anchored template declares a basis", () => {
    for (const t of templates) {
      const anchored = JSON.stringify(t.steps).includes('"anchored"');
      expect(Boolean(t.basis), `${t.seedId} basis`).toBe(anchored);
    }
  });
});

describe("render regression against the pre-rewrite baseline", () => {
  const ported = templates.filter((t) => baseline.has(t.seedId));

  it("covers every baseline template", () => {
    const missing = [...baseline.keys()].filter(
      (id) => !templates.some((t) => t.seedId === id)
    );
    expect(missing).toEqual([]);
  });

  for (const t of ported) {
    const reason = EXPECTED_DIFFS[t.seedId];
    const label = reason
      ? `${t.seedId} differs as intended — ${reason}`
      : `${t.seedId} renders byte-identically`;

    it(label, () => {
      const body = renderBody(t, {
        mapWatts: MAP_WATTS,
        ftpWatts: FTP_WATTS,
      });
      if (reason) {
        expect(body).not.toBe(baseline.get(t.seedId));
      } else {
        expect(body).toBe(baseline.get(t.seedId));
      }
    });
  }
});
