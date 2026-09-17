import { describe, it, expect } from "vitest";
import { unreviewableWorkSteps } from "../../../src/services/step-roles/index.js";

const FTP = 300;
const FLOOR = 264; // 88% of FTP

describe("unreviewableWorkSteps", () => {
  it("names a hard step whose label declares no work role", () => {
    const steps = unreviewableWorkSteps(
      ["- Warm-up 15m 160w", "- 20m 280w", "- Cooldown 10m 140w"].join("\n"),
      FLOOR,
      FTP
    );
    expect(steps).toEqual([{ index: 1, label: undefined, watts: 280 }]);
  });

  it("says nothing about a hard step that declares itself", () => {
    expect(unreviewableWorkSteps("- Threshold 20m 280w", FLOOR, FTP)).toEqual(
      []
    );
  });

  it("says nothing about an easy step, labelled or not", () => {
    expect(
      unreviewableWorkSteps(
        ["- Recovery 5m 150w", "- 45m 200w"].join("\n"),
        FLOOR,
        FTP
      )
    ).toEqual([]);
  });

  it("takes a band at its midpoint", () => {
    const [step] = unreviewableWorkSteps("- Chunk 12m 255w-285w", FLOOR, FTP);
    expect(step).toEqual({ index: 0, label: "Chunk", watts: 270 });
  });

  it("resolves a percent target against FTP", () => {
    const [step] = unreviewableWorkSteps("- Push one 20m 95%", FLOOR, FTP);
    expect(step?.watts).toBe(285);
  });

  it("stays quiet with no floor to judge against", () => {
    expect(unreviewableWorkSteps("- 20m 280w", undefined, null)).toEqual([]);
  });
});
