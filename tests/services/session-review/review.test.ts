import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  judgeStep,
  reviewSession,
  toDeliveredIntervals,
  DEFAULT_TOLERANCE,
} from "../../../src/services/session-review/review.js";
import { flattenPlannedSteps } from "../../../src/services/session-review/planned.js";
import type {
  DeliveredInterval,
  FlatPlannedStep,
} from "../../../src/services/session-review/types.js";

function fixture(name: string) {
  const path = fileURLToPath(
    new URL(`../../fixtures/session-review/${name}.json`, import.meta.url)
  );
  return JSON.parse(readFileSync(path, "utf8"));
}

function step(over: Partial<FlatPlannedStep> = {}): FlatPlannedStep {
  return { index: 0, sourceIndex: 0, durationSeconds: 300, ...over };
}

function delivered(over: Partial<DeliveredInterval> = {}): DeliveredInterval {
  return { index: 0, durationSeconds: 300, averageWatts: 300, ...over };
}

describe("judgeStep — point targets", () => {
  it("is on-target just inside tolerance below", () => {
    // 375 W target, 5% tolerance -> 356.25 W floor.
    const r = judgeStep(
      step({ target: { watts: 375 } }),
      delivered({ averageWatts: 357 }),
      0.05
    );
    expect(r.verdict).toBe("on-target");
    expect(r.watts).toBe(-18);
  });

  it("is under just outside tolerance below", () => {
    const r = judgeStep(
      step({ target: { watts: 375 } }),
      delivered({ averageWatts: 356 }),
      0.05
    );
    expect(r.verdict).toBe("under");
    expect(r.watts).toBe(-19);
  });

  it("is on-target just inside tolerance above", () => {
    const r = judgeStep(
      step({ target: { watts: 375 } }),
      delivered({ averageWatts: 393 }),
      0.05
    );
    expect(r.verdict).toBe("on-target");
  });

  it("is over just outside tolerance above", () => {
    const r = judgeStep(
      step({ target: { watts: 375 } }),
      delivered({ averageWatts: 395 }),
      0.05
    );
    expect(r.verdict).toBe("over");
    expect(r.watts).toBe(20);
    expect(r.wattsFraction).toBeCloseTo(20 / 375, 4);
  });

  it("widens with a caller-supplied tolerance", () => {
    const under = judgeStep(
      step({ target: { watts: 375 } }),
      delivered({ averageWatts: 350 }),
      0.05
    );
    expect(under.verdict).toBe("under");

    const tolerated = judgeStep(
      step({ target: { watts: 375 } }),
      delivered({ averageWatts: 350 }),
      0.1
    );
    expect(tolerated.verdict).toBe("on-target");
  });
});

describe("judgeStep — band targets", () => {
  it("is on-target anywhere inside the band, with a zero delta", () => {
    const r = judgeStep(
      step({ target: { low: 255, high: 275 } }),
      delivered({ averageWatts: 258 }),
      DEFAULT_TOLERANCE
    );
    expect(r.verdict).toBe("on-target");
    expect(r.watts).toBe(0);
  });

  it("measures from the edge crossed when below the band", () => {
    const r = judgeStep(
      step({ target: { low: 255, high: 275 } }),
      delivered({ averageWatts: 220 }),
      DEFAULT_TOLERANCE
    );
    expect(r.verdict).toBe("under");
    expect(r.watts).toBe(-35);
  });

  it("judges a ramp against its midpoint, not its ends", () => {
    const ramp = { low: 130, high: 220, ramp: true };

    // Sitting at the bottom of the ramp is "in range" but is not on target.
    expect(
      judgeStep(step({ target: ramp }), delivered({ averageWatts: 135 }), 0.05)
        .verdict
    ).toBe("under");

    // The prescribed average is 175 W.
    expect(
      judgeStep(step({ target: ramp }), delivered({ averageWatts: 176 }), 0.05)
        .verdict
    ).toBe("on-target");

    expect(
      judgeStep(step({ target: ramp }), delivered({ averageWatts: 215 }), 0.05)
        .verdict
    ).toBe("over");
  });

  it("still treats a plain band as an acceptable range", () => {
    // Same numbers, no ramp flag: anywhere inside is on target.
    expect(
      judgeStep(
        step({ target: { low: 130, high: 220 } }),
        delivered({ averageWatts: 135 }),
        0.05
      ).verdict
    ).toBe("on-target");
  });

  it("does not widen a band by the tolerance", () => {
    // 244 W against a prescribed 255-275 W block is a real under-delivery.
    // A band already states the spread the coach accepts; granting a further
    // 5% would report this on-target and hide the rep-1 shortfall.
    const r = judgeStep(
      step({ target: { low: 255, high: 275 } }),
      delivered({ averageWatts: 244 }),
      DEFAULT_TOLERANCE
    );
    expect(r.verdict).toBe("under");
    expect(r.watts).toBe(-11);

    // Even a very loose tolerance leaves the band's own edges intact.
    expect(
      judgeStep(
        step({ target: { low: 255, high: 275 } }),
        delivered({ averageWatts: 244 }),
        0.5
      ).verdict
    ).toBe("under");
  });

  it("measures from the edge crossed when above the band", () => {
    const r = judgeStep(
      step({ target: { low: 255, high: 275 } }),
      delivered({ averageWatts: 320 }),
      DEFAULT_TOLERANCE
    );
    expect(r.verdict).toBe("over");
    expect(r.watts).toBe(45);
  });
});

describe("judgeStep — duration and missing data", () => {
  it("reports not-attempted when the step was cut short", () => {
    const r = judgeStep(
      step({ durationSeconds: 300, target: { watts: 375 } }),
      delivered({ durationSeconds: 120, averageWatts: 90 }),
      DEFAULT_TOLERANCE
    );
    expect(r.verdict).toBe("not-attempted");
  });

  it("checks duration before power, so an abandoned step is not a power miss", () => {
    const r = judgeStep(
      step({ durationSeconds: 300, target: { watts: 375 } }),
      // On target for the 20s it lasted — but it did not last.
      delivered({ durationSeconds: 20, averageWatts: 375 }),
      DEFAULT_TOLERANCE
    );
    expect(r.verdict).toBe("not-attempted");
  });

  it("judges a step delivered just above the abandonment threshold", () => {
    const r = judgeStep(
      step({ durationSeconds: 300, target: { watts: 375 } }),
      delivered({ durationSeconds: 151, averageWatts: 375 }),
      DEFAULT_TOLERANCE
    );
    expect(r.verdict).toBe("on-target");
  });

  it("refuses to judge an unresolved target", () => {
    const r = judgeStep(
      step({ targetUnresolved: "percent-of-FTP target but no FTP" }),
      delivered(),
      DEFAULT_TOLERANCE
    );
    expect(r.verdict).toBe("unmatched");
    expect(r.note).toMatch(/no FTP/);
  });

  it("refuses to judge an interval with no power recorded", () => {
    const r = judgeStep(
      step({ target: { watts: 375 } }),
      delivered({ averageWatts: undefined }),
      DEFAULT_TOLERANCE
    );
    expect(r.verdict).toBe("unmatched");
    expect(r.note).toMatch(/no power recorded/);
  });
});

describe("reviewSession", () => {
  function loadPair(name: string) {
    const { event, activity } = fixture(name);
    return {
      planned: flattenPlannedSteps(event?.workout_doc),
      intervals: toDeliveredIntervals(activity?.icu_intervals ?? []),
      event,
      activity,
    };
  }

  it("reads the real sweet-spot session rep by rep", () => {
    const { planned, intervals, event, activity } = loadPair("sweet-spot-3x12");

    const result = reviewSession({
      planned,
      intervals,
      tolerance: DEFAULT_TOLERANCE,
      plannedLoad: event.icu_training_load,
      actualLoad: activity.icu_training_load,
      platformCompliance: activity.compliance,
    });

    expect(result.alignmentBasis).toBe("sequential");
    expect(result.steps).toHaveLength(8);

    // The three work reps, in order: 244 W, 270 W, 264 W against a 255-275 band.
    const work = result.steps.filter((s) => s.stepInRep === 1 && s.repIndex);
    expect(work.map((s) => s.delivered?.averageWatts)).toEqual([244, 270, 264]);
    expect(work.map((s) => s.verdict)).toEqual([
      "under",
      "on-target",
      "on-target",
    ]);
    expect(work[0].deltas?.watts).toBe(-11);
    expect(work.map((s) => s.repIndex)).toEqual([1, 2, 3]);
  });

  it("carries the roll-up including the platform's own compliance", () => {
    const { planned, intervals, event, activity } = loadPair("sweet-spot-3x12");

    const result = reviewSession({
      planned,
      intervals,
      tolerance: DEFAULT_TOLERANCE,
      plannedLoad: event.icu_training_load,
      actualLoad: activity.icu_training_load,
      plannedDurationSeconds: 4200,
      actualDurationSeconds: activity.moving_time,
      platformCompliance: activity.compliance,
    });

    expect(result.rollup.plannedLoad).toBe(75);
    expect(result.rollup.actualLoad).toBe(72);
    expect(result.rollup.platformCompliance).toBe(96);
    expect(result.rollup.unplannedIntervals).toEqual([]);
  });

  it("returns an empty step list but a full roll-up when alignment fails", () => {
    const { planned, intervals, event, activity } = loadPair("track-session");

    const result = reviewSession({
      planned,
      intervals,
      tolerance: DEFAULT_TOLERANCE,
      plannedLoad: event.icu_training_load,
      actualLoad: activity.icu_training_load,
      platformCompliance: activity.compliance,
    });

    expect(result.alignmentBasis).toBe("none");
    expect(result.steps).toEqual([]);
    expect(result.reason).toBe("alignment-failed");
    expect(result.message).toMatch(/rather than a pairing that may be wrong/);
    // The coarse question is still answered.
    expect(result.rollup.plannedLoad).toBe(73);
    expect(result.rollup.actualLoad).toBe(54);
    expect(result.rollup.platformCompliance).toBeCloseTo(73.97, 1);
  });

  it("omits delivered fields entirely on an unmatched step", () => {
    const planned = flattenPlannedSteps({
      steps: [
        { duration: 600, power: { units: "w", value: 160 } },
        { duration: 300, power: { units: "w", value: 280 } },
        { duration: 300, power: { units: "w", value: 280 } },
        { duration: 600, power: { units: "w", value: 140 } },
      ],
    });
    const intervals: DeliveredInterval[] = [
      { index: 0, durationSeconds: 600, averageWatts: 158 },
      { index: 1, durationSeconds: 300, averageWatts: 285 },
      { index: 2, durationSeconds: 600, averageWatts: 141 },
    ];

    const result = reviewSession({
      planned,
      intervals,
      tolerance: DEFAULT_TOLERANCE,
    });

    const unmatched = result.steps.filter((s) => s.verdict === "unmatched");
    expect(unmatched.length).toBeGreaterThan(0);
    for (const s of unmatched) {
      expect(s.delivered).toBeUndefined();
      expect(s.deltas).toBeUndefined();
      expect(s.note).toBeTruthy();
    }
  });

  it("reports recorded work that maps to no planned step", () => {
    const planned = flattenPlannedSteps({
      steps: [
        { duration: 600, power: { units: "w", value: 160 } },
        { duration: 300, power: { units: "w", value: 280 } },
        { duration: 120, power: { units: "w", value: 150 } },
        { duration: 300, power: { units: "w", value: 280 } },
        { duration: 600, power: { units: "w", value: 140 } },
      ],
    });
    const intervals: DeliveredInterval[] = [
      { index: 0, durationSeconds: 600, averageWatts: 160 },
      { index: 1, durationSeconds: 300, averageWatts: 280 },
      { index: 2, durationSeconds: 45, averageWatts: 620 },
      { index: 3, durationSeconds: 120, averageWatts: 150 },
      { index: 4, durationSeconds: 300, averageWatts: 275 },
      { index: 5, durationSeconds: 600, averageWatts: 140 },
    ];

    const result = reviewSession({
      planned,
      intervals,
      tolerance: DEFAULT_TOLERANCE,
    });

    expect(result.alignmentBasis).toBe("duration");
    expect(result.rollup.unplannedIntervals).toEqual([
      {
        intervalIndex: 2,
        type: undefined,
        durationSeconds: 45,
        averageWatts: 620,
      },
    ]);
  });
});

describe("toDeliveredIntervals", () => {
  it("drops zero-length intervals and normalises absent readings", () => {
    const out = toDeliveredIntervals([
      { elapsed_time: 300, average_watts: 250, average_cadence: 0 },
      { elapsed_time: 0, average_watts: 200 },
    ] as never);

    expect(out).toHaveLength(1);
    expect(out[0].averageWatts).toBe(250);
    // A zero cadence reading is absent data, not a real zero.
    expect(out[0].averageCadence).toBeUndefined();
  });
});
