import { describe, it, expect } from "vitest";
import {
  WORK_WORDS,
  firstWord,
  isWorkLabel,
  stepRole,
} from "../../../src/services/prescription/index.js";

describe("firstWord", () => {
  it("normalises the punctuation and casing a label actually carries", () => {
    expect(firstWord("Warm-up")).toBe("warmup");
    expect(firstWord("SST — hold the band")).toBe("sst");
    expect(firstWord("VO2")).toBe("vo2");
    expect(firstWord("Pre-load")).toBe("preload");
    expect(firstWord("  Sprint  ")).toBe("sprint");
  });

  it("returns undefined for a label with no word in it", () => {
    expect(firstWord(undefined)).toBeUndefined();
    expect(firstWord("")).toBeUndefined();
    expect(firstWord("   ")).toBeUndefined();
    expect(firstWord("—")).toBeUndefined();
  });
});

describe("isWorkLabel", () => {
  it("reads the first word only, so a prose label still declares its role", () => {
    expect(
      isWorkLabel(
        "Threshold. Sit at the top of sweet spot and hold it even — this keeps " +
          "CP where it is through the taper."
      )
    ).toBe(true);
    expect(isWorkLabel("Tempo. Sit in the band and stay there.")).toBe(true);
  });

  it("declares the support steps of a session as nothing at all", () => {
    for (const label of [
      "Recovery",
      "Easy",
      "Easy spin",
      "Warm-up",
      "Cool down",
      "Rest or roll",
      "Off",
    ]) {
      expect(isWorkLabel(label), label).toBe(false);
    }
  });

  it("treats an unrecognised label as undeclared, not as work", () => {
    // The step is carried and counted; it is never judged. A silent
    // classification is the one outcome this vocabulary exists to prevent.
    expect(isWorkLabel("Ramp 4")).toBe(false);
    expect(isWorkLabel("Build 1")).toBe(false);
    expect(isWorkLabel(undefined)).toBe(false);
  });

  it("holds the over-under halves as work, both of them", () => {
    expect(isWorkLabel("Over")).toBe(true);
    expect(isWorkLabel("Under")).toBe(true);
    expect(isWorkLabel("Float")).toBe(true);
  });

  it("leaves endurance and steady undeclared — the band lens reads those", () => {
    expect(isWorkLabel("Endurance")).toBe(false);
    expect(isWorkLabel("Steady tempo")).toBe(false);
  });
});

describe("stepRole", () => {
  it("names the two outcomes", () => {
    expect(stepRole("Sprint")).toBe("work");
    expect(stepRole("Recovery")).toBe("unclassified");
  });
});

describe("WORK_WORDS", () => {
  it("is normalised the same way a label is, so every entry can match", () => {
    for (const word of WORK_WORDS) {
      expect(firstWord(word), word).toBe(word);
    }
  });
});
