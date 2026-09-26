import { describe, it, expect } from "vitest";
import {
  prescriptionShape,
  readPrescription,
  targetMidpoint,
} from "../../../src/services/prescription/index.js";
import type { WorkoutDoc } from "../../../src/types.js";

const ANCHORS = { ftp: 300, powerZones: [55, 75, 90, 105, 120, 150, 999] };

describe("readPrescription", () => {
  it("reads workout text into resolved, role-tagged Planned steps", () => {
    const { steps, basis } = readPrescription(
      [
        "- Warm-up 10m 50%",
        "",
        "2x",
        "- Threshold 8m Z4",
        "- Easy 2m 150w",
      ].join("\n"),
      ANCHORS
    );

    expect(basis.source).toBe("local-parse");
    expect(steps.map((s) => [s.label, s.role, s.midpointWatts])).toEqual([
      ["Warm-up", "unclassified", 150],
      ["Threshold", "work", 293],
      ["Easy", "unclassified", 150],
      ["Threshold", "work", 293],
      ["Easy", "unclassified", 150],
    ]);
    expect(steps[1]).toMatchObject({ repIndex: 1, repCount: 2, stepInRep: 1 });
  });

  it("takes a platform document as it is, and says so", () => {
    const doc: WorkoutDoc = {
      steps: [
        {
          text: "Tempo",
          duration: 600,
          power: { start: 220, end: 240, units: "w" },
        },
      ],
    };
    const { steps, basis, discarded } = readPrescription(doc, ANCHORS);
    expect(basis).toEqual({ source: "platform" });
    expect(discarded).toEqual([]);
    expect(steps[0]).toMatchObject({ role: "work", midpointWatts: 230 });
  });

  it("names a zone target it has no zones to resolve against", () => {
    const [step] = readPrescription("- Push 5m Z4", { ftp: 300 }).steps;
    expect(step.midpointWatts).toBeUndefined();
    expect(step.targetUnresolved).toBeDefined();
  });

  it("reads nothing from nothing", () => {
    expect(readPrescription(undefined).steps).toEqual([]);
  });
});

describe("targetMidpoint", () => {
  it("keeps the half watt", () => {
    expect(targetMidpoint({ low: 200, high: 245 })).toBe(222.5);
    expect(targetMidpoint({ watts: 250 })).toBe(250);
    expect(targetMidpoint(undefined)).toBeUndefined();
  });
});

describe("prescriptionShape", () => {
  it("expands repeats and counts distance steps without timing them", () => {
    expect(
      prescriptionShape("- 10m 200w\n\n2x\n- 1km 300w\n- 1m 150w")
    ).toEqual({
      stepCount: 5,
      totalSeconds: 600 + 2 * 60,
      hasDistance: true,
    });
  });
});
