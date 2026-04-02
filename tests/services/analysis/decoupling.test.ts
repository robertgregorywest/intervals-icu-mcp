import { describe, it, expect } from "vitest";
import { computeAerobicDecoupling } from "../../../src/services/analysis/decoupling.js";

describe("computeAerobicDecoupling", () => {
  it("calculates decoupling from power and HR streams", () => {
    // First half: avg power ~200, avg HR ~140 → ratio ~0.7
    // Second half: avg power ~200, avg HR ~150 → ratio ~0.75
    const power = Array(100).fill(200);
    const hr = [...Array(50).fill(140), ...Array(50).fill(150)];

    const result = computeAerobicDecoupling(power, hr);

    expect(result.firstHalf.avgPower).toBe(200);
    expect(result.firstHalf.avgHR).toBe(140);
    expect(result.secondHalf.avgPower).toBe(200);
    expect(result.secondHalf.avgHR).toBe(150);
    expect(result.decouplingPercent).toBeGreaterThan(0);
    expect(result.interpretation).toContain("aerobic");
  });

  it("returns good interpretation for low decoupling", () => {
    const power = Array(100).fill(200);
    const hr = [...Array(50).fill(140), ...Array(50).fill(142)];

    const result = computeAerobicDecoupling(power, hr);

    expect(Math.abs(result.decouplingPercent)).toBeLessThan(5);
    expect(result.interpretation).toContain("Good aerobic fitness");
  });

  it("returns high interpretation for large decoupling", () => {
    const power = Array(100).fill(200);
    const hr = [...Array(50).fill(130), ...Array(50).fill(160)];

    const result = computeAerobicDecoupling(power, hr);

    expect(Math.abs(result.decouplingPercent)).toBeGreaterThan(10);
    expect(result.interpretation).toContain("High decoupling");
  });

  it("filters out zero records", () => {
    const power = [0, 200, 200, 0, 200, 200, 0, 200, 200, 200];
    const hr = [0, 140, 140, 0, 140, 140, 0, 150, 150, 150];

    const result = computeAerobicDecoupling(power, hr);

    // Should only use non-zero records
    expect(result.firstHalf.avgPower).toBeGreaterThan(0);
    expect(result.secondHalf.avgPower).toBeGreaterThan(0);
  });

  it("throws on empty streams", () => {
    expect(() => computeAerobicDecoupling([], [])).toThrow(
      "No valid records after filtering zeros"
    );
  });

  it("throws when no power data", () => {
    expect(() => computeAerobicDecoupling([0, 0, 0], [140, 140, 140])).toThrow(
      "No power data found"
    );
  });

  it("throws when no HR data", () => {
    expect(() => computeAerobicDecoupling([200, 200, 200], [0, 0, 0])).toThrow(
      "No heart rate data found"
    );
  });
});
