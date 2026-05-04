import { describe, it, expect, vi } from "vitest";
import {
  CANONICAL_TEMPLATES,
  materializeTemplate,
  runSeed,
  type SeedTemplate,
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

const vo2: SeedTemplate = {
  seedId: "vo2-test",
  name: "VO2 test",
  folder: "Coach: VO2 Max",
  description: "Hard intervals.",
  steps: [
    { label: "Warm-up", duration: "10m", intensity: { basis: "MAP", pct: 60 } },
    {
      iterations: 4,
      steps: [
        {
          label: "On",
          duration: "4m",
          intensity: { basis: "MAP", pct: [95, 102] },
        },
        {
          label: "Off",
          duration: "4m",
          intensity: { basis: "MAP", pct: 50 },
        },
      ],
    },
  ],
};

describe("CANONICAL_TEMPLATES", () => {
  it("each template uses a single intensity basis", () => {
    for (const tmpl of CANONICAL_TEMPLATES) {
      const bases = new Set<string>();
      for (const node of tmpl.steps) {
        if ("iterations" in node) {
          for (const s of node.steps) bases.add(s.intensity.basis);
        } else {
          bases.add(node.intensity.basis);
        }
      }
      expect(bases.size, `${tmpl.seedId} mixes bases`).toBe(1);
    }
  });

  it("seedIds are unique", () => {
    const ids = CANONICAL_TEMPLATES.map((t) => t.seedId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("materializeTemplate", () => {
  it("computes watts from MAP and embeds rationale", () => {
    const result = materializeTemplate(vo2, { mapWatts: 380 }, builder);
    if ("skip" in result) throw new Error("expected materialization");
    expect(result.basis).toBe("MAP");
    expect(result.anchorWatts).toBe(380);

    expect(result.description).toContain("Hard intervals.");
    expect(result.description).toContain("- Warm-up 10m 228w");
    // 95% of 380 = 361, 102% of 380 = 387.6 → 388
    expect(result.description).toContain("- On 4m 361w-388w");
    expect(result.description).toContain("- Off 4m 190w");
    expect(result.description).toMatch(/4x\n- On 4m 361w-388w\n- Off 4m 190w/);

    const rationale = extractRationale(result.description);
    expect(rationale).toEqual({
      basis: "MAP",
      anchorWatts: 380,
      seedId: "vo2-test",
      intensities: [
        { stepRef: "Warm-up", pct: 60 },
        { stepRef: "On", pct: [95, 102] },
        { stepRef: "Off", pct: 50 },
      ],
    });
  });

  it("returns skip when required anchor is missing", () => {
    const result = materializeTemplate(vo2, { ftpWatts: 290 }, builder);
    expect("skip" in result).toBe(true);
    if ("skip" in result) {
      expect(result.skip).toContain("mapWatts");
    }
  });

  it("supports FTP-anchored templates", () => {
    const tmpl: SeedTemplate = {
      seedId: "thr",
      name: "Threshold",
      folder: "Coach: Threshold",
      description: "x",
      steps: [
        {
          label: "On",
          duration: "20m",
          intensity: { basis: "FTP", pct: 100 },
        },
      ],
    };
    const result = materializeTemplate(tmpl, { ftpWatts: 290 }, builder);
    if ("skip" in result) throw new Error("expected materialization");
    expect(result.basis).toBe("FTP");
    expect(result.description).toContain("- On 20m 290w");
  });
});

describe("runSeed", () => {
  it("creates folder hierarchy and posts workouts", async () => {
    const api = fakeApi();
    let nextFolderId = 100;
    let nextWorkoutId = 1000;
    api.createFolder = vi
      .fn()
      .mockImplementation(async (name: string, parent: number | null) => ({
        id: nextFolderId++,
        name,
        type: "FOLDER",
        children: [],
        ...(parent !== null ? { parent } : {}),
      }));
    api.createWorkout = vi.fn().mockImplementation(async (input) => ({
      id: nextWorkoutId++,
      ...input,
    }));

    const report = await runSeed(api, builder, {
      mapWatts: 380,
      ftpWatts: 290,
    });

    expect(report.dryRun).toBe(false);
    expect(report.created.length).toBe(CANONICAL_TEMPLATES.length);
    expect(report.skipped).toEqual([]);
    expect(report.warnings).toEqual([]);

    // Flat "Coach: <category>" folders are created (no parent nesting)
    const folderCalls = (api.createFolder as ReturnType<typeof vi.fn>).mock
      .calls;
    const folderNames = folderCalls.map((c) => c[0]);
    expect(folderNames).toContain("Coach: VO2 Max");
    expect(folderNames).toContain("Coach: Tests");
    expect(folderNames).toContain("Coach: Endurance");
    // parent must always be null — API doesn't support nesting on create
    for (const call of folderCalls) {
      expect(call[1]).toBeNull();
    }

    // Each created action carries a workoutId
    for (const action of report.created) {
      expect(action.workoutId).toBeGreaterThanOrEqual(1000);
    }
  });

  it("dryRun does not create folders or workouts", async () => {
    const api = fakeApi();
    const report = await runSeed(api, builder, {
      mapWatts: 380,
      ftpWatts: 290,
      dryRun: true,
    });
    expect(report.dryRun).toBe(true);
    expect(api.createFolder).not.toHaveBeenCalled();
    expect(api.createWorkout).not.toHaveBeenCalled();
    expect(report.created.length).toBe(CANONICAL_TEMPLATES.length);
    for (const action of report.created) {
      expect(action.workoutId).toBeUndefined();
    }
  });

  it("skips templates whose name already exists in the target folder", async () => {
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 2,
          name: "Coach: VO2 Max",
          type: "FOLDER",
          children: [
            { id: 99, name: "VO2 4×4", type: "Ride", description: "old" },
          ],
        },
      ]),
    });
    let nextFolderId = 100;
    let nextWorkoutId = 1000;
    api.createFolder = vi.fn().mockImplementation(async (name: string) => ({
      id: nextFolderId++,
      name,
      type: "FOLDER",
      children: [],
    }));
    api.createWorkout = vi.fn().mockImplementation(async (input) => ({
      id: nextWorkoutId++,
      ...input,
    }));

    const report = await runSeed(api, builder, {
      mapWatts: 380,
      ftpWatts: 290,
    });

    const skipped = report.skipped.find((s) => s.seedId === "vo2-4x4");
    expect(skipped).toBeDefined();
    expect(skipped?.reason).toContain("already exists");

    const createdNames = report.created.map((c) => c.name);
    expect(createdNames).not.toContain("VO2 4×4");
  });

  it("warns when mapWatts is missing and skips MAP-anchored templates", async () => {
    const api = fakeApi();
    api.createFolder = vi.fn().mockImplementation(async (name: string) => ({
      id: 1,
      name,
      type: "FOLDER",
      children: [],
    }));
    api.createWorkout = vi
      .fn()
      .mockImplementation(async (input) => ({ id: 1000, ...input }));

    const report = await runSeed(api, builder, { ftpWatts: 290 });

    expect(report.warnings.some((w) => w.includes("mapWatts"))).toBe(true);
    const skippedSeedIds = report.skipped.map((s) => s.seedId);
    expect(skippedSeedIds).toContain("vo2-4x4");
    expect(skippedSeedIds).toContain("z2-endurance-2h");
    expect(skippedSeedIds).toContain("recovery-spin");
    // FTP-anchored should still be created
    const createdSeedIds = report.created.map((c) => c.seedId);
    expect(createdSeedIds).toContain("threshold-2x20");
    expect(createdSeedIds).toContain("sweet-spot-3x12");
  });
});
