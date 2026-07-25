import { describe, it, expect } from "vitest";
import { parseTemplate } from "../../../src/services/workout-library/template.js";
import {
  renderBody,
  renderDescription,
  extractSeedId,
  MissingAnchorError,
} from "../../../src/services/workout-library/render.js";

function parse(frontmatter: string, body: string) {
  return parseTemplate(`---\n${frontmatter}\n---\n\n${body}\n`, "x.md");
}

const META = "seedId: t\nname: T\nfolder: Coach\npurpose: Purpose line.";

describe("anchored targets", () => {
  it("resolves percentages against the basis, rounded to 5 W", () => {
    const t = parse(`${META}\nbasis: MAP`, "- On 4m 95-102%\n- Off 4m 50%");
    expect(renderBody(t, { mapWatts: 415 })).toBe(
      "- On 4m 395w-425w\n\n- Off 4m 210w"
    );
  });

  it("uses the FTP anchor for an FTP template", () => {
    const t = parse(`${META}\nbasis: FTP`, "- Threshold 20m 95-105%");
    expect(renderBody(t, { mapWatts: 415, ftpWatts: 290 })).toBe(
      "- Threshold 20m 275w-305w"
    );
  });

  it("throws when the needed anchor is absent", () => {
    const t = parse(`${META}\nbasis: MAP`, "- On 4m 95%");
    expect(() => renderBody(t, { ftpWatts: 290 })).toThrow(MissingAnchorError);
  });

  it("renders a literal template with no anchors at all", () => {
    const t = parse(META, "- 3m 150w\n- Cooldown 10m 160w");
    expect(renderBody(t, {})).toBe("- 3m 150w\n\n- Cooldown 10m 160w");
  });

  it("leaves modified percentages, zones and cadence untouched", () => {
    const t = parse(
      `${META}\nbasis: FTP`,
      "- A 5m 64-75% LTHR\n- B 10m Z1\n- C 30m 50% 95rpm"
    );
    expect(renderBody(t, { ftpWatts: 290 })).toBe(
      "- A 5m 64-75% LTHR\n\n- B 10m Z1\n\n- C 30m 145w 95rpm"
    );
  });
});

describe("repeat rendering", () => {
  it("emits a leaf block as a native Nx", () => {
    const t = parse(`${META}\nbasis: MAP`, "4x\n  - On 4m 95%\n  - Off 4m 50%");
    expect(renderBody(t, { mapWatts: 415 })).toBe(
      "4x\n- On 4m 395w\n- Off 4m 210w"
    );
  });

  it("keeps a leaf block's label", () => {
    const t = parse(`${META}\nbasis: MAP`, "Main Set 4x\n  - On 4m 95%");
    expect(renderBody(t, { mapWatts: 415 })).toBe("Main Set 4x\n- On 4m 395w");
  });

  // Intervals.icu supports only one level of Nx, so an outer block is unrolled
  // and its label has nowhere to live.
  it("unrolls a block containing a block and discards its label", () => {
    const t = parse(
      `${META}\nbasis: MAP`,
      [
        "Series 2x",
        "  - Preload 2m 95%",
        "  3x",
        "    - On 30s 100%",
        "    - Off 15s 50%",
      ].join("\n")
    );
    expect(renderBody(t, { mapWatts: 415 })).toBe(
      [
        "- Preload 2m 395w",
        "",
        "3x",
        "- On 30s 415w",
        "- Off 15s 210w",
        "",
        "- Preload 2m 395w",
        "",
        "3x",
        "- On 30s 415w",
        "- Off 15s 210w",
      ].join("\n")
    );
  });
});

describe("renderDescription", () => {
  it("puts purpose first, then prose, steps, then the marker", () => {
    const t = parseTemplate(
      `---\n${META}\nbasis: MAP\n---\n\nLonger rationale.\n\n- On 4m 95%\n`,
      "x.md"
    );
    expect(renderDescription(t, { mapWatts: 415 })).toBe(
      "Purpose line.\n\nLonger rationale.\n\n- On 4m 395w\n\n<!-- template: t -->"
    );
  });

  it("round-trips its own seedId", () => {
    const t = parse(META, "- 5m 150w");
    expect(extractSeedId(renderDescription(t, {}))).toBe("t");
  });
});

describe("extractSeedId", () => {
  it("reads the current marker", () => {
    expect(extractSeedId("x\n<!-- template: vo2-4x4 -->")).toBe("vo2-4x4");
  });

  // Workouts written by the retired seed path must keep matching their template
  // so the first sync updates them in place rather than creating duplicates.
  it("falls back to a legacy rationale block", () => {
    expect(
      extractSeedId(
        'x\n<!-- rationale {"basis":"MAP","anchorWatts":380,"seedId":"vo2-4x4"} -->'
      )
    ).toBe("vo2-4x4");
  });

  it("returns null for unmanaged or malformed descriptions", () => {
    expect(extractSeedId("- 5m 95%")).toBeNull();
    expect(extractSeedId("x\n<!-- rationale not-json -->")).toBeNull();
    expect(extractSeedId('x\n<!-- rationale {"basis":"MAP"} -->')).toBeNull();
  });
});
