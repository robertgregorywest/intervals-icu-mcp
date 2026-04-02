import { describe, it, expect } from "vitest";
import {
  computeBestPower,
  formatDuration,
} from "../../../src/services/analysis/power.js";

describe("computeBestPower", () => {
  it("finds best power over a sliding window", () => {
    const stream = [100, 150, 200, 250, 300, 200, 100];
    const result = computeBestPower(stream, 3);

    expect(result).not.toBeNull();
    expect(result!.bestPower).toBe(250); // (200+250+300)/3
    expect(result!.startIndex).toBe(2);
  });

  it("returns null if duration exceeds stream length", () => {
    const result = computeBestPower([100, 200], 5);
    expect(result).toBeNull();
  });

  it("handles single-second duration", () => {
    const stream = [100, 300, 200];
    const result = computeBestPower(stream, 1);

    expect(result!.bestPower).toBe(300);
    expect(result!.startIndex).toBe(1);
  });

  it("handles uniform power", () => {
    const stream = Array(60).fill(200);
    const result = computeBestPower(stream, 30);

    expect(result!.bestPower).toBe(200);
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(30)).toBe("30s");
  });

  it("formats even minutes", () => {
    expect(formatDuration(300)).toBe("5min");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90)).toBe("1min 30s");
  });
});
