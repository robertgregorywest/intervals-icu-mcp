import { describe, it, expect } from "vitest";
import {
  extractRationale,
  embedRationale,
  stripRationale,
  parseDescriptionSummary,
} from "../../../src/services/workout-library/parser.js";

describe("extractRationale", () => {
  it("returns null when no rationale block present", () => {
    expect(extractRationale("- 5m 95%")).toBeNull();
  });

  it("parses an embedded JSON rationale", () => {
    const desc =
      '- 4m 360w\n\n<!-- rationale {"basis":"MAP","anchorWatts":380} -->';
    const r = extractRationale(desc);
    expect(r).toEqual({ basis: "MAP", anchorWatts: 380 });
  });

  it("rejects rationale without a valid basis", () => {
    const desc = '- 4m\n\n<!-- rationale {"basis":"WATTS"} -->';
    expect(extractRationale(desc)).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    const desc = "- 4m\n\n<!-- rationale not-json -->";
    expect(extractRationale(desc)).toBeNull();
  });
});

describe("embedRationale + stripRationale", () => {
  it("round-trips", () => {
    const body = "- 4m 360w";
    const rationale = {
      basis: "MAP" as const,
      anchorWatts: 380,
      seedId: "vo2-4x4",
    };
    const embedded = embedRationale(body, rationale);
    expect(embedded).toContain(body);
    expect(extractRationale(embedded)).toEqual(rationale);
    expect(stripRationale(embedded)).toBe(body);
  });

  it("replaces an existing rationale block", () => {
    const original = embedRationale("- 4m 360w", {
      basis: "MAP",
      anchorWatts: 380,
    });
    const replaced = embedRationale(original, {
      basis: "FTP",
      anchorWatts: 290,
    });
    expect(extractRationale(replaced)).toEqual({
      basis: "FTP",
      anchorWatts: 290,
    });
    // Only one rationale block remains
    const matches = replaced.match(/<!--\s*rationale/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

describe("parseDescriptionSummary", () => {
  it("counts simple steps and sums durations", () => {
    const desc = "- 10m 75%\n- 5m 50%";
    const s = parseDescriptionSummary(desc);
    expect(s.stepCount).toBe(2);
    expect(s.totalSeconds).toBe(15 * 60);
    expect(s.oneLine).toBe("2 steps, 15m");
    expect(s.hasRationale).toBe(false);
  });

  it("expands repeat blocks", () => {
    const desc = "4x\n- 4m 110%\n- 4m 50%";
    const s = parseDescriptionSummary(desc);
    expect(s.stepCount).toBe(8);
    expect(s.totalSeconds).toBe(4 * (4 * 60 + 4 * 60));
  });

  it("handles labels and complex durations", () => {
    const desc = "- Warmup 10m 60%\n- Main 1h2m30s 75%";
    const s = parseDescriptionSummary(desc);
    expect(s.stepCount).toBe(2);
    expect(s.totalSeconds).toBe(10 * 60 + (1 * 3600 + 2 * 60 + 30));
  });

  it("flags distance-based steps", () => {
    const desc = "- 2km 90%";
    const s = parseDescriptionSummary(desc);
    expect(s.stepCount).toBe(1);
    expect(s.totalSeconds).toBe(0);
    expect(s.oneLine).toContain("includes distance steps");
  });

  it("ignores rationale block when summarizing", () => {
    const desc =
      '- 4m 360w\n\n<!-- rationale {"basis":"MAP","anchorWatts":380} -->';
    const s = parseDescriptionSummary(desc);
    expect(s.stepCount).toBe(1);
    expect(s.hasRationale).toBe(true);
  });

  it("returns empty summary for blank descriptions", () => {
    expect(parseDescriptionSummary("").oneLine).toBe("Empty workout");
  });
});
