import { describe, it, expect } from "vitest";
import { unreviewableWorkSteps } from "../../../src/services/prescription/index.js";

const FTP = 300;
const FLOOR = 264; // 88% of FTP
const ANCHORS = { ftp: FTP, powerZones: [55, 75, 90, 105, 120, 150, 999] };

describe("unreviewableWorkSteps", () => {
  it("names a hard step whose label declares no work role", () => {
    const steps = unreviewableWorkSteps(
      ["- Warm-up 15m 160w", "- 20m 280w", "- Cooldown 10m 140w"].join("\n"),
      FLOOR,
      ANCHORS
    );
    expect(steps).toEqual([{ index: 1, label: undefined, watts: 280 }]);
  });

  it("says nothing about a hard step that declares itself", () => {
    expect(
      unreviewableWorkSteps("- Threshold 20m 280w", FLOOR, ANCHORS)
    ).toEqual([]);
  });

  it("says nothing about an easy step, labelled or not", () => {
    expect(
      unreviewableWorkSteps(
        ["- Recovery 5m 150w", "- 45m 200w"].join("\n"),
        FLOOR,
        ANCHORS
      )
    ).toEqual([]);
  });

  it("takes a band at its midpoint", () => {
    const [step] = unreviewableWorkSteps(
      "- Chunk 12m 255w-285w",
      FLOOR,
      ANCHORS
    );
    expect(step).toEqual({ index: 0, label: "Chunk", watts: 270 });
  });

  it("resolves a percent target against FTP", () => {
    const [step] = unreviewableWorkSteps("- Push one 20m 95%", FLOOR, ANCHORS);
    expect(step?.watts).toBe(285);
  });

  it("stays quiet with no floor to judge against", () => {
    expect(unreviewableWorkSteps("- 20m 280w", undefined, {})).toEqual([]);
  });

  // Regression: the warning used to skip zone resolution, so a work step
  // written as a zone never got a watt target and was silently left out.
  it("resolves a zone target before judging it", () => {
    const [step] = unreviewableWorkSteps("- Push 20m Z4", FLOOR, ANCHORS);
    // Z4 of 300 W resolves to 271-315 W, midpoint 293 W.
    expect(step).toEqual({ index: 0, label: "Push", watts: 293 });
  });

  it("judges against the same unrounded midpoint the digest selects on", () => {
    // 263-264 W has a midpoint of 263.5, under the 264 W floor — rounding it
    // up would warn on a step the digest does not select.
    expect(
      unreviewableWorkSteps("- Chunk 12m 263w-264w", FLOOR, ANCHORS)
    ).toEqual([]);
  });
});
