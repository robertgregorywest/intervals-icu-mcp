import { describe, it, expect, vi } from "vitest";
import { runSync } from "../../../src/services/workout-library/sync.js";
import { parseTemplate } from "../../../src/services/workout-library/template.js";
import { renderDescription } from "../../../src/services/workout-library/render.js";
import type { IWorkoutLibraryApi } from "../../../src/services/workout-library/api.js";

const ANCHORS = { mapWatts: 415, ftpWatts: 290 };

function template(
  seedId: string,
  opts: { name?: string; folder?: string; body?: string } = {}
) {
  return parseTemplate(
    [
      "---",
      `seedId: ${seedId}`,
      `name: ${opts.name ?? seedId}`,
      `folder: ${opts.folder ?? "Coach: Tests"}`,
      "purpose: Purpose line.",
      "basis: MAP",
      "---",
      "",
      opts.body ?? "- On 4m 95%",
      "",
    ].join("\n"),
    `${seedId}.md`
  );
}

function fakeApi(
  folders: unknown[] = [],
  overrides: Partial<IWorkoutLibraryApi> = {}
): IWorkoutLibraryApi {
  return {
    listFolders: vi.fn().mockResolvedValue(folders),
    getWorkout: vi.fn(),
    createFolder: vi
      .fn()
      .mockImplementation((name: string) =>
        Promise.resolve({ id: 900, name, type: "FOLDER" })
      ),
    createWorkout: vi.fn().mockResolvedValue({ id: 1000 }),
    updateWorkout: vi.fn().mockResolvedValue({}),
    deleteWorkout: vi.fn(),
    deleteFolder: vi.fn(),
    ...overrides,
  } as IWorkoutLibraryApi;
}

function folderWith(id: number, name: string, workouts: unknown[]) {
  return { id, name, type: "FOLDER", children: workouts };
}

describe("runSync — creating", () => {
  it("creates a workout that has no remote counterpart", async () => {
    const api = fakeApi();
    const report = await runSync(api, ANCHORS, [template("vo2-4x4")]);

    expect(report.created).toHaveLength(1);
    expect(report.created[0]).toMatchObject({
      seedId: "vo2-4x4",
      workoutId: 1000,
    });
    expect(api.createFolder).toHaveBeenCalledWith("Coach: Tests", null);
    expect(api.createWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "vo2-4x4",
        folder_id: 900,
        type: "Ride",
      })
    );
  });

  it("writes nothing on a dry run", async () => {
    const api = fakeApi();
    const report = await runSync(api, { ...ANCHORS, dryRun: true }, [
      template("vo2-4x4"),
    ]);

    expect(report.dryRun).toBe(true);
    expect(report.created).toHaveLength(1);
    expect(report.created[0].workoutId).toBeUndefined();
    expect(api.createWorkout).not.toHaveBeenCalled();
    expect(api.createFolder).not.toHaveBeenCalled();
  });
});

describe("runSync — idempotency", () => {
  it("skips when the rendered description already matches", async () => {
    const t = template("vo2-4x4");
    const api = fakeApi([
      folderWith(1, "Coach: Tests", [
        {
          id: 10,
          name: "vo2-4x4",
          type: "Ride",
          description: renderDescription(t, ANCHORS),
        },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, [t]);

    expect(report.unchanged).toHaveLength(1);
    expect(report.updated).toHaveLength(0);
    expect(api.updateWorkout).not.toHaveBeenCalled();
  });

  // The retired refresh compared anchors, so an edit at unchanged MAP was
  // silently skipped. Content comparison catches it.
  it("updates a step edit even when the anchor has not moved", async () => {
    const before = template("vo2-4x4", { body: "- On 4m 95%" });
    const after = template("vo2-4x4", { body: "- On 5m 95%" });
    const api = fakeApi([
      folderWith(1, "Coach: Tests", [
        {
          id: 10,
          name: "vo2-4x4",
          type: "Ride",
          description: renderDescription(before, ANCHORS),
        },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, [after]);

    expect(report.updated).toHaveLength(1);
    expect(report.updated[0].changed).toEqual(["description"]);
    expect(api.updateWorkout).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ description: expect.stringContaining("5m") })
    );
  });

  it("re-anchors when MAP moves", async () => {
    const t = template("vo2-4x4");
    const api = fakeApi([
      folderWith(1, "Coach: Tests", [
        {
          id: 10,
          name: "vo2-4x4",
          type: "Ride",
          description: renderDescription(t, { mapWatts: 380 }),
        },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, [t]);

    expect(report.updated).toHaveLength(1);
    const patch = (api.updateWorkout as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { description: string };
    expect(patch.description).toContain("395w");
  });
});

describe("runSync — identity changes", () => {
  it("pushes a rename and a folder move", async () => {
    const t = template("vo2-4x4", {
      name: "VO2 4×4",
      folder: "Coach: VO2 Max",
    });
    const api = fakeApi([
      folderWith(1, "Coach: Tests", [
        {
          id: 10,
          name: "Old name",
          type: "Ride",
          description: renderDescription(t, ANCHORS),
        },
      ]),
      folderWith(2, "Coach: VO2 Max", []),
    ]);

    const report = await runSync(api, ANCHORS, [t]);

    expect(report.updated[0].changed).toEqual(["name", "folder"]);
    expect(api.updateWorkout).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ name: "VO2 4×4", folder_id: 2 })
    );
  });

  it("matches a legacy rationale-marked workout and rewrites its marker", async () => {
    const t = template("vo2-4x4");
    const api = fakeApi([
      folderWith(1, "Coach: Tests", [
        {
          id: 10,
          name: "vo2-4x4",
          type: "Ride",
          description:
            '- On 4m 360w\n\n<!-- rationale {"basis":"MAP","anchorWatts":380,"seedId":"vo2-4x4"} -->',
        },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, [t]);

    expect(report.created).toHaveLength(0);
    expect(report.updated).toHaveLength(1);
    const patch = (api.updateWorkout as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { description: string };
    expect(patch.description).toContain("<!-- template: vo2-4x4 -->");
    expect(patch.description).not.toContain("rationale");
  });
});

describe("runSync — safety", () => {
  it("reports an orphan and never deletes", async () => {
    const api = fakeApi([
      folderWith(1, "Coach: Tests", [
        {
          id: 99,
          name: "Retired",
          type: "Ride",
          description: "- 5m 200w\n\n<!-- template: gone-away -->",
        },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, []);

    expect(report.orphans).toEqual([
      {
        workoutId: 99,
        name: "Retired",
        folder: "Coach: Tests",
        seedId: "gone-away",
      },
    ]);
    expect(api.deleteWorkout).not.toHaveBeenCalled();
    expect(report.warnings[0]).toMatch(/Nothing was deleted/);
  });

  it("leaves unmanaged workouts entirely alone", async () => {
    const api = fakeApi([
      folderWith(1, "Workouts", [
        {
          id: 5,
          name: "Hand-written",
          type: "Ride",
          description: "- 30m 200w",
        },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, []);

    expect(report.orphans).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
    expect(api.updateWorkout).not.toHaveBeenCalled();
  });

  it("skips a template whose anchor was not supplied", async () => {
    const report = await runSync(fakeApi(), { ftpWatts: 290 }, [
      template("vo2-4x4"),
    ]);

    expect(report.created).toHaveLength(0);
    expect(report.skipped[0].reason).toMatch(/mapWatts/);
  });

  it("warns when two workouts claim the same seedId", async () => {
    const t = template("vo2-4x4");
    const desc = renderDescription(t, ANCHORS);
    const api = fakeApi([
      folderWith(1, "Coach: Tests", [
        { id: 10, name: "vo2-4x4", type: "Ride", description: desc },
        { id: 11, name: "vo2-4x4 copy", type: "Ride", description: desc },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, [t]);

    expect(report.warnings[0]).toMatch(/Two library workouts claim seedId/);
  });
});

describe("runSync — adopting pre-marker workouts", () => {
  it("claims an unmarked workout with the same name and folder", async () => {
    const t = template("map-ramp-test", {
      name: "MAP ramp test",
      folder: "Coach: Tests",
    });
    const api = fakeApi([
      folderWith(1, "Coach: Tests", [
        {
          id: 17,
          name: "MAP ramp test",
          type: "Ride",
          description: "- Warm-up 3m 150w",
        },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, [t]);

    expect(report.created).toHaveLength(0);
    expect(report.updated[0]).toMatchObject({ workoutId: 17, adopted: true });
    expect(api.createWorkout).not.toHaveBeenCalled();
  });

  it("does not adopt across folders", async () => {
    const t = template("openers", { name: "Openers", folder: "Coach: Race" });
    const api = fakeApi([
      folderWith(1, "Workouts", [
        { id: 2, name: "Openers", type: "Ride", description: "- 20m 160w" },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, [t]);

    expect(report.created).toHaveLength(1);
    expect(report.updated).toHaveLength(0);
  });

  // A workout already owned by another template must never be stolen.
  it("does not adopt a workout that carries a marker", async () => {
    const t = template("a", { name: "Shared name", folder: "Coach: Tests" });
    const api = fakeApi([
      folderWith(1, "Coach: Tests", [
        {
          id: 20,
          name: "Shared name",
          type: "Ride",
          description: "- 5m 200w\n\n<!-- template: someone-else -->",
        },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, [t]);

    expect(report.created).toHaveLength(1);
    expect(report.orphans[0].seedId).toBe("someone-else");
  });

  it("refuses to adopt when the name is ambiguous", async () => {
    const t = template("x", { name: "Dupe", folder: "Coach: Tests" });
    const api = fakeApi([
      folderWith(1, "Coach: Tests", [
        { id: 30, name: "Dupe", type: "Ride", description: "- 5m 200w" },
        { id: 31, name: "Dupe", type: "Ride", description: "- 6m 200w" },
      ]),
    ]);

    const report = await runSync(api, ANCHORS, [t]);

    expect(report.created).toHaveLength(1);
    expect(api.updateWorkout).not.toHaveBeenCalled();
  });
});
