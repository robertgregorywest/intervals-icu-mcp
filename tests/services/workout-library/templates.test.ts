import { describe, it, expect } from "vitest";
import { loadTemplates } from "../../../src/services/workout-library/loader.js";
import { renderDescription } from "../../../src/services/workout-library/render.js";

/**
 * Anchors are fixed, not the athlete's live MAP/FTP: the snapshot pins what the
 * renderer does, not what today's fitness happens to be.
 */
const MAP_WATTS = 415;
const FTP_WATTS = 290;

const templates = loadTemplates();

describe("shipped templates", () => {
  it("all parse", () => {
    expect(templates.length).toBeGreaterThan(0);
  });

  it("every template has a purpose", () => {
    for (const t of templates) {
      expect(t.purpose.trim(), `${t.seedId} purpose`).not.toBe("");
    }
  });

  it("seedIds are unique", () => {
    const ids = templates.map((t) => t.seedId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every anchored template declares a basis", () => {
    for (const t of templates) {
      const anchored = JSON.stringify(t.steps).includes('"anchored"');
      expect(Boolean(t.basis), `${t.seedId} basis`).toBe(anchored);
    }
  });
});

/**
 * The full description of every template, exactly as `sync_workout_library`
 * will write it to Intervals.icu.
 *
 * This guards the renderer: edit render/parse/template code and any unintended
 * change to a shipped workout shows up here across every template at once. It
 * is deliberately regenerable — when you edit a template on purpose, run
 * `npm test -- -u` and the diff in the committed snapshot becomes the review
 * artifact for the session you'll actually ride.
 */
describe("rendered descriptions", () => {
  it("match the committed snapshot", async () => {
    const rendered = templates
      .map((t) =>
        [
          "=".repeat(72),
          `seedId: ${t.seedId}`,
          `name:   ${t.name}`,
          `folder: ${t.folder}`,
          `basis:  ${t.basis ? `${t.basis} @ ${t.basis === "MAP" ? MAP_WATTS : FTP_WATTS}w` : "(none)"}`,
          `type:   ${t.type}`,
          "-".repeat(72),
          renderDescription(t, { mapWatts: MAP_WATTS, ftpWatts: FTP_WATTS }),
        ].join("\n")
      )
      .join("\n\n");

    await expect(
      `# Rendered at MAP=${MAP_WATTS}W FTP=${FTP_WATTS}W\n\n${rendered}\n`
    ).toMatchFileSnapshot("../../fixtures/rendered-templates.txt");
  });
});
