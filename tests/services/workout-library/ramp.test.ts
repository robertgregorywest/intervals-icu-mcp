import { describe, it, expect } from "vitest";
import {
  expandRamp,
  DEFAULT_MAX_STEP_SEC,
  DEFAULT_MAX_RANGE_PCT,
} from "../../../src/services/workout-library/ramp.js";
import { materializeTemplate } from "../../../src/services/workout-library/seed.js";
import type { SeedTemplate } from "../../../src/services/workout-library/seed.js";
import { createWorkoutBuilder } from "../../../src/services/workout-builder/index.js";

const builder = createWorkoutBuilder();

function durationToSeconds(d: string): number {
  let s = 0;
  for (const m of d.matchAll(/(\d+)(h|m|s)/gi)) {
    const v = Number(m[1]);
    if (m[2] === "h") s += v * 3600;
    else if (m[2] === "m") s += v * 60;
    else s += v;
  }
  return s;
}

describe("expandRamp", () => {
  it("chooses step count = max(durationMin, rangeMin)", () => {
    // 20m / 2m = 10 duration steps; (110-40)/8 = 8.75 -> 9 range steps
    const steps = expandRamp({
      from: 40,
      to: 110,
      duration: "20m",
      basis: "MAP",
    });
    expect(steps).toHaveLength(10);

    // Wide-but-short ramp is range-driven: 1m -> 1 duration step,
    // (40-110)/8 -> 9 range steps.
    const wide = expandRamp({
      from: 40,
      to: 110,
      duration: "1m",
      basis: "MAP",
    });
    expect(wide).toHaveLength(9);
  });

  it("emits contiguous, monotonic sub-ranges spanning exactly [from, to]", () => {
    const steps = expandRamp({
      from: 40,
      to: 110,
      duration: "20m",
      basis: "MAP",
    });
    const ranges = steps.map((s) => s.intensity.pct as [number, number]);
    expect(ranges[0][0]).toBe(40);
    expect(ranges[ranges.length - 1][1]).toBe(110);
    for (let i = 0; i < ranges.length; i++) {
      expect(ranges[i][1]).toBeGreaterThan(ranges[i][0]); // increasing within step
      if (i > 0) {
        expect(ranges[i][0]).toBe(ranges[i - 1][1]); // contiguous
      }
    }
  });

  it("summed durations equal the original", () => {
    const steps = expandRamp({
      from: 40,
      to: 110,
      duration: "20m",
      basis: "MAP",
    });
    const total = steps.reduce(
      (acc, s) => acc + durationToSeconds(s.duration),
      0
    );
    expect(total).toBe(20 * 60);

    // Uneven case: 25m over duration cap should still sum exactly.
    const uneven = expandRamp({
      from: 50,
      to: 60,
      duration: "25m",
      basis: "FTP",
    });
    const unevenTotal = uneven.reduce(
      (acc, s) => acc + durationToSeconds(s.duration),
      0
    );
    expect(unevenTotal).toBe(25 * 60);
  });

  it("every step satisfies both caps", () => {
    const steps = expandRamp({
      from: 40,
      to: 110,
      duration: "20m",
      basis: "MAP",
    });
    for (const s of steps) {
      expect(durationToSeconds(s.duration)).toBeLessThanOrEqual(
        DEFAULT_MAX_STEP_SEC
      );
      const [lo, hi] = s.intensity.pct as [number, number];
      expect(hi - lo).toBeLessThanOrEqual(DEFAULT_MAX_RANGE_PCT + 1e-9);
    }
  });

  it("emits narrow-range steps (no ramp flag) with basis/label/cadence", () => {
    const steps = expandRamp({
      from: 40,
      to: 110,
      duration: "20m",
      basis: "MAP",
      label: "Ramp",
      cadence: "90rpm",
    });
    for (const s of steps) {
      expect(s.ramp).toBeUndefined();
      expect(Array.isArray(s.intensity.pct)).toBe(true);
      expect(s.intensity.basis).toBe("MAP");
      expect(s.label).toBe("Ramp");
      expect(s.cadence).toBe("90rpm");
    }
  });

  it("honours granularity overrides", () => {
    const steps = expandRamp({
      from: 50,
      to: 100,
      duration: "10m",
      basis: "MAP",
      maxStepDurationSec: 60,
      maxRangeWidthPct: 5,
    });
    // 10m / 1m = 10 duration steps; 50/5 = 10 range steps
    expect(steps).toHaveLength(10);
    for (const s of steps) {
      expect(durationToSeconds(s.duration)).toBeLessThanOrEqual(60);
      const [lo, hi] = s.intensity.pct as [number, number];
      expect(hi - lo).toBeLessThanOrEqual(5 + 1e-9);
    }
  });

  it("materializes to clean nearest-5 W targets for canonical anchors", () => {
    const tmpl: SeedTemplate = {
      seedId: "ramp-test",
      name: "Ramp",
      folder: "Coach: Tests",
      description: "x",
      steps: [
        ...expandRamp({ from: 40, to: 110, duration: "20m", basis: "MAP" }),
      ],
    };
    const m = materializeTemplate(tmpl, { mapWatts: 380 }, builder);
    if ("skip" in m) throw new Error("expected materialization");
    const watts = [...m.body.matchAll(/(\d+)w/g)].map((x) => Number(x[1]));
    for (const w of watts) {
      expect(w % 5).toBe(0);
    }
    // no single wide ramp line remains
    expect(m.body).not.toContain("ramp");
  });
});
