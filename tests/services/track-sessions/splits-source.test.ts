/**
 * Handing a record's splits back in the inline form the two alignment tools
 * take. The round trip is the point: what comes out must parse back to the same
 * runs, or `sessionId` would be a quieter way to mistype the export.
 */

import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import {
  loadTrackSessionRecords,
  resolveTrackSplits,
  serializeSplits,
  TrackComparisonError,
} from "../../../src/services/track-sessions/index.js";
import { parseLapSplits } from "../../../src/services/track-lap-alignment/index.js";

const FIXTURES = fileURLToPath(
  new URL("../../fixtures/track-sessions", import.meta.url)
);

const { records } = loadTrackSessionRecords(FIXTURES);
const find = (id: string) => records.find((r) => r.basis.id === id)!;

describe("serializeSplits", () => {
  it("round-trips through the parser to the same runs", () => {
    const record = find("2026-07-12-training");
    const reparsed = parseLapSplits(serializeSplits(record), 250);
    expect(reparsed).toEqual(record.runs);
  });

  it("writes a header row and one row per lap, in export order", () => {
    const record = find("2026-nationals-ip");
    const lines = serializeSplits(record).split("\n");
    expect(lines[0]).toBe("run,cumDist,cumTime,lap");
    expect(lines).toHaveLength(1 + 8);
    expect(lines[1]).toBe("race,250,23.21,23.21");
  });
});

describe("resolveTrackSplits", () => {
  it("returns the splits plus the basis the alignment would need supplying", () => {
    const source = resolveTrackSplits("2026-09-06-bmrc-ip", records);
    expect(source.sessionId).toBe("2026-09-06-bmrc-ip");
    expect(source.activityId).toBe("i183857008");
    expect(source.lapDistanceMeters).toBe(250);
    expect(source.runs).toEqual(["race"]);
    expect(source.splits).toContain("race,250,22.86,22.86");
  });

  it("leaves activityId absent when no ride was recorded", () => {
    // 2025 Nationals is a timing export with no SRM behind it.
    expect(resolveTrackSplits("2025-nationals-ip", records).activityId).toBe(
      undefined
    );
  });

  it("names the available sessions when the id is unknown", () => {
    expect(() => resolveTrackSplits("no-such-session", records)).toThrow(
      TrackComparisonError
    );
    expect(() => resolveTrackSplits("no-such-session", records)).toThrow(
      /Available: .*2026-nationals-ip/
    );
  });

  it("says so plainly when no records are loaded at all", () => {
    expect(() => resolveTrackSplits("anything", [])).toThrow(
      /No records are loaded/
    );
  });
});
