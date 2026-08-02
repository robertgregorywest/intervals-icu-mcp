import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  flattenPlannedSteps,
  normalisePowerTarget,
  plannedDuration,
} from "../../../src/services/session-review/planned.js";
import type { WorkoutDoc } from "../../../src/types.js";

function fixture(name: string) {
  const path = fileURLToPath(
    new URL(`../../fixtures/session-review/${name}.json`, import.meta.url)
  );
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("flattenPlannedSteps", () => {
  it("expands a repeat block into one step per rep per inner step", () => {
    // Real event 107665970: 3× a 10-rep 30/30 block, plus surrounding steps.
    const { event } = fixture("vo2-repeats");
    const flat = flattenPlannedSteps(event.workout_doc as WorkoutDoc);

    // 15 doc entries: 12 simple + 3 repeat blocks of 10 reps × 2 steps.
    expect(flat.length).toBe(12 + 3 * 10 * 2);

    const block = flat.filter((s) => s.repCount === 10);
    expect(block.length).toBe(60);
    expect(block[0].repIndex).toBe(1);
    expect(block[0].stepInRep).toBe(1);
    expect(block[1].repIndex).toBe(1);
    expect(block[1].stepInRep).toBe(2);
    expect(block[2].repIndex).toBe(2);
    expect(block[19].repIndex).toBe(10);
    expect(block[19].stepInRep).toBe(2);
  });

  it("expands the sweet-spot block to 8 comparable steps", () => {
    // Real event 123780516: warm-up, 3×(12min work / 4min recovery), cooldown.
    const { event } = fixture("sweet-spot-3x12");
    const flat = flattenPlannedSteps(event.workout_doc as WorkoutDoc);

    expect(flat.length).toBe(8);
    expect(flat.map((s) => s.durationSeconds)).toEqual([
      720, 720, 240, 720, 240, 720, 240, 600,
    ]);
    // The work steps carry a band target, preserved as a band.
    expect(flat[1].target).toEqual({ low: 255, high: 275 });
    expect(flat[1].repIndex).toBe(1);
    expect(flat[5].repIndex).toBe(3);
    expect(flat[5].stepInRep).toBe(1);
  });

  it("assigns contiguous indices and keeps the originating doc index", () => {
    const { event } = fixture("sweet-spot-3x12");
    const flat = flattenPlannedSteps(event.workout_doc as WorkoutDoc);

    expect(flat.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // All six repeat-block steps trace back to doc entry 1.
    expect(flat.slice(1, 7).every((s) => s.sourceIndex === 1)).toBe(true);
    expect(flat[7].sourceIndex).toBe(2);
  });

  it("recurses into nested repeat blocks rather than dropping them", () => {
    const doc: WorkoutDoc = {
      steps: [
        {
          reps: 2,
          steps: [
            {
              reps: 3,
              steps: [{ duration: 30, power: { units: "w", value: 400 } }],
            },
            { duration: 60, power: { units: "w", value: 150 } },
          ],
        },
      ],
    };
    const flat = flattenPlannedSteps(doc);

    // 2 × (3 inner + 1) = 8 steps, none lost.
    expect(flat.length).toBe(8);
    expect(plannedDuration(flat)).toBe(2 * (3 * 30 + 60));
  });

  it("returns an empty list when the event carries no structured steps", () => {
    const { event } = fixture("no-structured-steps");
    expect(flattenPlannedSteps(event.workout_doc)).toEqual([]);
    expect(flattenPlannedSteps(undefined)).toEqual([]);
  });
});

describe("normalisePowerTarget", () => {
  it("reads a point target in watts", () => {
    expect(normalisePowerTarget({ units: "w", value: 375 }, null)).toEqual({
      target: { watts: 375 },
    });
  });

  it("preserves a band rather than collapsing it to a midpoint", () => {
    expect(
      normalisePowerTarget({ units: "w", start: 180, end: 215 }, null)
    ).toEqual({ target: { low: 180, high: 215 } });
  });

  it("treats a degenerate band as a point target", () => {
    expect(
      normalisePowerTarget({ units: "w", start: 200, end: 200 }, null)
    ).toEqual({ target: { watts: 200 } });
  });

  it("marks a ramp's ends as a ramp, not an acceptable band", () => {
    expect(
      normalisePowerTarget({ units: "w", start: 130, end: 220 }, null, true)
    ).toEqual({ target: { low: 130, high: 220, ramp: true } });
  });

  it("carries the ramp flag through flattening from real workout_doc", () => {
    // Event 107665964: "Warmup — build gradually 20m ramp 130w-220w".
    const { event } = fixture("ramp-warmup");
    const flat = flattenPlannedSteps(event.workout_doc as WorkoutDoc);

    expect(flat[0].target).toEqual({ low: 130, high: 220, ramp: true });
    // The interval steps in the same workout are plain bands.
    expect(flat[1].target).toEqual({ low: 348, high: 375 });
  });

  it("resolves a percent target against FTP", () => {
    expect(normalisePowerTarget({ units: "%", value: 90 }, 290)).toEqual({
      target: { watts: 261 },
    });
  });

  it("names the failure when a percent target has no FTP to resolve against", () => {
    const { target, unresolved } = normalisePowerTarget(
      { units: "%", value: 90 },
      null
    );
    expect(target).toBeUndefined();
    expect(unresolved).toMatch(/no FTP/);
  });

  it("names the failure for units it cannot convert", () => {
    const { target, unresolved } = normalisePowerTarget(
      { units: "hr", value: 150 },
      290
    );
    expect(target).toBeUndefined();
    expect(unresolved).toMatch(/unsupported/);
  });
});
