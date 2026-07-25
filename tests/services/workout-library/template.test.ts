import { describe, it, expect } from "vitest";
import {
  parseTemplate,
  TemplateParseError,
} from "../../../src/services/workout-library/template.js";

function tpl(frontmatter: string, body: string): string {
  return `---\n${frontmatter}\n---\n\n${body}\n`;
}

const BASIC = "seedId: vo2-4x4\nname: VO2 4×4\nfolder: Coach\npurpose: Test.";

describe("frontmatter", () => {
  it("splits on the first colon so folder names keep theirs", () => {
    const t = parseTemplate(
      tpl(
        'seedId: x\nname: X\nfolder: "Coach: VO2 Max"\npurpose: Test.',
        "- 5m 200w"
      ),
      "x.md"
    );
    expect(t.folder).toBe("Coach: VO2 Max");
  });

  it("defaults type to Ride", () => {
    const t = parseTemplate(tpl(BASIC, "- 5m 200w"), "x.md");
    expect(t.type).toBe("Ride");
  });

  it("requires purpose", () => {
    expect(() =>
      parseTemplate(
        tpl("seedId: x\nname: X\nfolder: Coach", "- 5m 200w"),
        "x.md"
      )
    ).toThrow(/purpose/);
  });

  it("rejects a non-kebab seedId", () => {
    expect(() =>
      parseTemplate(
        tpl("seedId: VO2_4x4\nname: X\nfolder: C\npurpose: P.", "- 5m 200w"),
        "x.md"
      )
    ).toThrow(TemplateParseError);
  });

  it("rejects a multi-line value rather than silently misreading it", () => {
    expect(() =>
      parseTemplate(
        tpl("seedId: x\nname: X\nfolder: C\npurpose:", "- 5m 200w"),
        "x.md"
      )
    ).toThrow(/keep it on one line/);
  });
});

describe("targets", () => {
  it("treats a bare percentage as anchored", () => {
    const t = parseTemplate(
      tpl(`${BASIC}\nbasis: MAP`, "- On 4m 95-102%"),
      "x.md"
    );
    expect(t.steps[0]).toMatchObject({
      label: "On",
      duration: "4m",
      anchored: [95, 102],
    });
  });

  // A percentage with a modifier is a different unit entirely and must not move
  // when MAP/FTP moves.
  it("treats a percentage with a modifier as literal", () => {
    const t = parseTemplate(tpl(BASIC, "- 5m 64-75% LTHR"), "x.md");
    expect(t.steps[0]).toMatchObject({ target: "64-75% LTHR" });
    expect((t.steps[0] as { anchored?: unknown }).anchored).toBeUndefined();
  });

  it("keeps cadence separate from the target", () => {
    const t = parseTemplate(
      tpl(`${BASIC}\nbasis: MAP`, "- Preload 2m 95-100% 95rpm"),
      "x.md"
    );
    expect(t.steps[0]).toMatchObject({ cadence: "95rpm", anchored: [95, 100] });
  });

  it("does not mistake a label word for a duration", () => {
    const t = parseTemplate(tpl(BASIC, "- Ramp to failure 1m 140w"), "x.md");
    expect(t.steps[0]).toMatchObject({
      label: "Ramp to failure",
      duration: "1m",
      target: "140w",
    });
  });

  it("rejects a ramp step in target position", () => {
    expect(() =>
      parseTemplate(
        tpl(`${BASIC}\nbasis: MAP`, "- Ramp 20m ramp 40-110%"),
        "x.md"
      )
    ).toThrow(/collapse to a single averaged target/);
  });
});

// Intervals.icu re-reads a rendered line, so a label carrying a structural
// token is silently eaten there rather than here — the workout on the head unit
// is wrong while the file looks right. Fail at load instead.
describe("labels", () => {
  it.each([
    ["a zone token", "- Z2 2h 60%", "Z2"],
    ["watts", "- Openers 350w 5m 60%", "350w"],
    ["a percentage", "- Best 75% 5m 60%", "75%"],
    ["cadence", "- Spin 95rpm 5m 60%", "95rpm"],
  ])("rejects a step label containing %s", (_what, body, token) => {
    const parse = () =>
      parseTemplate(tpl(`${BASIC}\nbasis: MAP`, body), "x.md");
    expect(parse).toThrow(TemplateParseError);
    // The message must name the offending token — the fix is to edit that word.
    expect(parse).toThrow(new RegExp(token.replace(/[%$]/g, "\\$&")));
  });

  it("rejects a repeat-block label containing a duration", () => {
    expect(() =>
      parseTemplate(
        tpl(
          `${BASIC}\nbasis: MAP`,
          ["Preload 2m 3x", "  - On 30s 100%"].join("\n")
        ),
        "x.md"
      )
    ).toThrow(/2m/);
  });

  // The rule targets tokens Intervals.icu parses as structure, not every token
  // that merely contains digits — real labels like this must keep working.
  it("allows plain-text labels with incidental numbers", () => {
    const t = parseTemplate(
      tpl(`${BASIC}\nbasis: FTP`, "- 20min effort 20m 95-105%"),
      "x.md"
    );
    expect(t.steps[0]).toMatchObject({
      label: "20min effort",
      duration: "20m",
    });
  });
});

describe("basis", () => {
  it("requires a basis when a step is anchored", () => {
    expect(() => parseTemplate(tpl(BASIC, "- On 4m 95%"), "x.md")).toThrow(
      /no `basis` is declared/
    );
  });

  it("rejects a basis when nothing is anchored", () => {
    expect(() =>
      parseTemplate(tpl(`${BASIC}\nbasis: MAP`, "- On 4m 350w"), "x.md")
    ).toThrow(/no step uses a bare percentage/);
  });

  it("allows a fully literal template with no basis", () => {
    const t = parseTemplate(tpl(BASIC, "- 3m 150w\n- 1m 175w"), "x.md");
    expect(t.basis).toBeUndefined();
    expect(t.steps).toHaveLength(2);
  });
});

describe("repeat blocks", () => {
  it("nests by indentation", () => {
    const t = parseTemplate(
      tpl(
        `${BASIC}\nbasis: MAP`,
        [
          "Series 3x",
          "  - Preload 2m 95%",
          "  12x",
          "    - On 30s 100%",
          "    - Off 15s 50%",
          "  - Rec 3m 50%",
        ].join("\n")
      ),
      "x.md"
    );
    expect(t.steps).toHaveLength(1);
    const outer = t.steps[0] as {
      kind: string;
      iterations: number;
      label?: string;
      children: unknown[];
    };
    expect(outer.kind).toBe("repeat");
    expect(outer.iterations).toBe(3);
    expect(outer.label).toBe("Series");
    expect(outer.children).toHaveLength(3);
    expect(
      (outer.children[1] as { kind: string; iterations: number }).iterations
    ).toBe(12);
  });

  it("rejects an empty block", () => {
    expect(() => parseTemplate(tpl(BASIC, "4x\n- 5m 200w"), "x.md")).toThrow(
      /must be indented under it/
    );
  });
});

describe("prose", () => {
  it("captures text before the first step and rejects text after", () => {
    const t = parseTemplate(tpl(BASIC, "Some rationale.\n\n- 5m 200w"), "x.md");
    expect(t.prose).toBe("Some rationale.");
    expect(() =>
      parseTemplate(tpl(BASIC, "- 5m 200w\n\nTrailing note."), "x.md")
    ).toThrow(/prose is not allowed between steps/);
  });
});
