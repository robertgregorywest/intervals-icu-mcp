import { describe, it, expect, vi } from "vitest";
import {
  runRefresh,
  extractProse,
} from "../../../src/services/workout-library/refresh.js";
import {
  CANONICAL_TEMPLATES,
  materializeTemplate,
} from "../../../src/services/workout-library/seed.js";
import { extractRationale } from "../../../src/services/workout-library/parser.js";
import type { IWorkoutLibraryApi } from "../../../src/services/workout-library/api.js";
import { createWorkoutBuilder } from "../../../src/services/workout-builder/index.js";

const builder = createWorkoutBuilder();

function fakeApi(
  overrides: Partial<IWorkoutLibraryApi> = {}
): IWorkoutLibraryApi {
  return {
    listFolders: vi.fn().mockResolvedValue([]),
    getWorkout: vi.fn(),
    createFolder: vi.fn(),
    createWorkout: vi.fn(),
    updateWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    deleteFolder: vi.fn(),
    ...overrides,
  };
}

function seededWorkout(seedId: string, anchorWatts: number) {
  const tmpl = CANONICAL_TEMPLATES.find((t) => t.seedId === seedId);
  if (!tmpl) throw new Error(`unknown seed ${seedId}`);
  const m = materializeTemplate(
    tmpl,
    { mapWatts: anchorWatts, ftpWatts: anchorWatts },
    builder
  );
  if ("skip" in m) throw new Error(m.skip);
  return {
    id: 100 + Math.floor(Math.random() * 9000),
    name: tmpl.name,
    type: "Ride",
    description: m.description,
  };
}

describe("extractProse", () => {
  it("returns text before the first step", () => {
    const desc =
      "Some prose.\nMore prose.\n\n- 5m 200w\n- 5m 100w\n\n<!-- rationale {} -->";
    expect(extractProse(desc)).toBe("Some prose.\nMore prose.");
  });

  it("handles repeat header as the first step marker", () => {
    const desc = "Intro line.\n\n4x\n- On 4m 360w\n- Off 4m 180w";
    expect(extractProse(desc)).toBe("Intro line.");
  });

  it("returns empty string when description starts with a step", () => {
    expect(extractProse("- 30m 60%")).toBe("");
  });

  it("strips rationale block before scanning", () => {
    const desc =
      'Prose only.\n\n<!-- rationale {"basis":"MAP","anchorWatts":380} -->';
    expect(extractProse(desc)).toBe("Prose only.");
  });
});

describe("runRefresh", () => {
  it("regenerates watts on a seeded workout when anchor changes", async () => {
    const w = seededWorkout("vo2-4x4", 380);
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Coach: VO2 Max",
          type: "FOLDER",
          children: [w],
        },
      ]),
    });

    const report = await runRefresh(api, builder, { mapWatts: 394 });

    expect(report.updated).toHaveLength(1);
    expect(report.updated[0]).toMatchObject({
      workoutId: w.id,
      name: "VO2 4×4",
      folder: "Coach: VO2 Max",
      seedId: "vo2-4x4",
      basis: "MAP",
      oldAnchorWatts: 380,
      newAnchorWatts: 394,
    });
    expect(api.updateWorkout).toHaveBeenCalledTimes(1);
    const [updateId, patch] = (api.updateWorkout as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(updateId).toBe(w.id);
    expect(patch.description).toContain("- On 4m"); // structure preserved
    // 95% of 394 = 374.3 → 375, 102% of 394 = 401.88 → 400 (nearest 5 W)
    expect(patch.description).toContain("- On 4m 375w-400w");
    const newRationale = extractRationale(patch.description);
    expect(newRationale?.anchorWatts).toBe(394);
  });

  it("re-anchors every step line of an expanded multi-step ramp", async () => {
    const w = seededWorkout("map-ramp-test", 380);
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Coach: Tests",
          type: "FOLDER",
          children: [w],
        },
      ]),
    });

    const report = await runRefresh(api, builder, { mapWatts: 400 });

    expect(report.updated).toHaveLength(1);
    const [, patch] = (api.updateWorkout as ReturnType<typeof vi.fn>).mock
      .calls[0];
    // First and last ramp segments re-anchor at the new MAP (nearest 5 W):
    // 40% × 400 = 160, 47% × 400 = 188 → 190; 103% × 400 = 412 → 410, 110% = 440.
    expect(patch.description).toContain("- Ramp 2m 160w-190w");
    expect(patch.description).toContain("- Ramp 2m 410w-440w");
    // No stale 380-anchored watts remain on any ramp line.
    expect(patch.description).not.toContain("150w-180w");
    // Prose preserved, anchor updated.
    expect(patch.description).toContain("Ramp test to exhaustion.");
    expect(extractRationale(patch.description)?.anchorWatts).toBe(400);
  });

  it("preserves user-edited prose above the steps", async () => {
    const baseline = seededWorkout("vo2-4x4", 380);
    const userEdited = {
      ...baseline,
      description: baseline.description.replace(
        /^[\s\S]*?(?=\n\n- )/,
        "User notes: prefer this on Saturdays. Watch breathing on rep 3."
      ),
    };
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Coach: VO2 Max",
          type: "FOLDER",
          children: [userEdited],
        },
      ]),
    });

    await runRefresh(api, builder, { mapWatts: 394 });

    const [, patch] = (api.updateWorkout as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(patch.description).toContain("User notes: prefer this on Saturdays");
    expect(patch.description).toContain("Watch breathing on rep 3");
    expect(patch.description).not.toContain("Seiler"); // original prose gone
  });

  it("skips workouts already at the requested anchor", async () => {
    const w = seededWorkout("vo2-4x4", 394);
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Coach: VO2 Max",
          type: "FOLDER",
          children: [w],
        },
      ]),
    });

    const report = await runRefresh(api, builder, { mapWatts: 394 });

    expect(report.updated).toHaveLength(0);
    expect(report.skipped).toHaveLength(1);
    expect(report.skipped[0].reason).toMatch(/already at 394W/);
    expect(api.updateWorkout).not.toHaveBeenCalled();
  });

  it("skips workouts whose anchor basis was not provided", async () => {
    const mapWorkout = seededWorkout("vo2-4x4", 380); // basis MAP
    const ftpWorkout = seededWorkout("threshold-2x20", 290); // basis FTP
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Coach: VO2 Max",
          type: "FOLDER",
          children: [mapWorkout],
        },
        {
          id: 2,
          name: "Coach: Threshold",
          type: "FOLDER",
          children: [ftpWorkout],
        },
      ]),
    });

    const report = await runRefresh(api, builder, { mapWatts: 394 });

    expect(report.updated.map((u) => u.seedId)).toEqual(["vo2-4x4"]);
    const ftpSkip = report.skipped.find((s) => s.workoutId === ftpWorkout.id);
    expect(ftpSkip?.reason).toContain("ftpWatts not provided");
  });

  it("refreshes a custom workout (unknown seedId) using its embedded intensities", async () => {
    const w = {
      id: 999,
      name: "Custom 2×10",
      type: "Ride",
      description:
        'Notes about why I like this.\n\n- On 10m 200w\n- Off 5m 100w\n- On 10m 200w\n- Off 5m 100w\n\n<!-- rationale {"basis":"FTP","anchorWatts":250,"seedId":"my-custom-2x10","intensities":[{"stepRef":"On","pct":80},{"stepRef":"Off","pct":40},{"stepRef":"On","pct":80},{"stepRef":"Off","pct":40}]} -->',
    };
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Coach: Custom",
          type: "FOLDER",
          children: [w],
        },
      ]),
    });

    const report = await runRefresh(api, builder, { ftpWatts: 290 });

    expect(report.updated).toHaveLength(1);
    expect(report.updated[0].seedId).toBe("my-custom-2x10");
    const [, patch] = (api.updateWorkout as ReturnType<typeof vi.fn>).mock
      .calls[0];
    // 80% × 290 = 232 → 230, 40% × 290 = 116 → 115 (nearest 5 W)
    expect(patch.description).toContain("- On 10m 230w");
    expect(patch.description).toContain("- Off 5m 115w");
    expect(patch.description).toContain("Notes about why I like this.");
  });

  it("skips workouts whose rationale has no intensities array", async () => {
    const w = {
      id: 999,
      name: "Bare rationale",
      type: "Ride",
      description:
        '- 10m 200w\n\n<!-- rationale {"basis":"MAP","anchorWatts":380} -->',
    };
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Coach: VO2 Max",
          type: "FOLDER",
          children: [w],
        },
      ]),
    });

    const report = await runRefresh(api, builder, { mapWatts: 394 });
    expect(report.updated).toHaveLength(0);
    expect(report.skipped[0].reason).toContain("no intensities array");
  });

  it("ignores workouts without a rationale block", async () => {
    const w = {
      id: 5,
      name: "Plain ride",
      type: "Ride",
      description: "- 1h 200w",
    };
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Coach: VO2 Max",
          type: "FOLDER",
          children: [w],
        },
      ]),
    });

    const report = await runRefresh(api, builder, { mapWatts: 394 });
    expect(report.updated).toHaveLength(0);
    expect(report.skipped).toHaveLength(0);
    expect(api.updateWorkout).not.toHaveBeenCalled();
  });

  it("dryRun does not call updateWorkout", async () => {
    const w = seededWorkout("vo2-4x4", 380);
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Coach: VO2 Max",
          type: "FOLDER",
          children: [w],
        },
      ]),
    });

    const report = await runRefresh(api, builder, {
      mapWatts: 394,
      dryRun: true,
    });
    expect(report.dryRun).toBe(true);
    expect(report.updated).toHaveLength(1);
    expect(api.updateWorkout).not.toHaveBeenCalled();
  });
});
