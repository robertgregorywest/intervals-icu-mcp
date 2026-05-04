import { describe, it, expect, vi } from "vitest";
import {
  runCreate,
  DEFAULT_CUSTOM_FOLDER,
} from "../../../src/services/workout-library/create.js";
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

describe("runCreate", () => {
  it("creates a workout under the requested folder, creating the folder when missing", async () => {
    const api = fakeApi();
    api.createFolder = vi
      .fn()
      .mockResolvedValue({ id: 50, name: "Coach: Tempo", type: "FOLDER" });
    api.createWorkout = vi
      .fn()
      .mockResolvedValue({ id: 200, name: "Tempo 4×10" });

    const result = await runCreate(api, builder, {
      name: "Tempo 4×10",
      folder: "Coach: Tempo",
      description: "Sub-threshold tempo work.",
      steps: [
        {
          iterations: 4,
          steps: [
            { duration: "10m", target: "240w" },
            { duration: "3m", target: "150w" },
          ],
        },
      ],
    });

    expect(result).toEqual({
      workoutId: 200,
      name: "Tempo 4×10",
      folder: "Coach: Tempo",
      description: expect.any(String),
    });
    expect(api.createFolder).toHaveBeenCalledWith("Coach: Tempo", null);
    expect(api.createWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Tempo 4×10",
        folder_id: 50,
        type: "Ride",
      })
    );
    expect(result.description).toContain("Sub-threshold tempo work.");
    expect(result.description).toContain("- 10m 240w");
  });

  it("uses the existing folder if one with the same name already exists", async () => {
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 7,
          name: "Coach: Custom",
          type: "FOLDER",
          children: [],
        },
      ]),
    });
    api.createWorkout = vi
      .fn()
      .mockResolvedValue({ id: 201, name: "Custom A" });

    await runCreate(api, builder, {
      name: "Custom A",
      steps: [{ duration: "30m", target: "200w" }],
    });

    expect(api.createFolder).not.toHaveBeenCalled();
    expect(api.createWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ folder_id: 7 })
    );
  });

  it("defaults to 'Coach: Custom' when no folder specified", async () => {
    const api = fakeApi();
    api.createFolder = vi.fn().mockResolvedValue({
      id: 8,
      name: DEFAULT_CUSTOM_FOLDER,
      type: "FOLDER",
    });
    api.createWorkout = vi.fn().mockResolvedValue({ id: 1, name: "X" });

    await runCreate(api, builder, {
      name: "X",
      steps: [{ duration: "10m", target: "200w" }],
    });

    expect(api.createFolder).toHaveBeenCalledWith(DEFAULT_CUSTOM_FOLDER, null);
  });

  it("throws on workout name collision in the target folder", async () => {
    const api = fakeApi({
      listFolders: vi.fn().mockResolvedValue([
        {
          id: 9,
          name: "Coach: VO2 Max",
          type: "FOLDER",
          children: [
            { id: 99, name: "VO2 4×4", type: "Ride", description: "..." },
          ],
        },
      ]),
    });

    await expect(
      runCreate(api, builder, {
        name: "VO2 4×4",
        folder: "Coach: VO2 Max",
        steps: [{ duration: "4m", target: "360w" }],
      })
    ).rejects.toThrow(/already exists/);
    expect(api.createWorkout).not.toHaveBeenCalled();
  });

  it("embeds a rationale block when provided", async () => {
    const api = fakeApi({
      listFolders: vi
        .fn()
        .mockResolvedValue([
          { id: 1, name: "Coach: Custom", type: "FOLDER", children: [] },
        ]),
    });
    api.createWorkout = vi
      .fn()
      .mockImplementation(async (input) => ({ id: 42, ...input }));

    const result = await runCreate(api, builder, {
      name: "Custom VO2",
      description: "My personal favourite.",
      steps: [
        { duration: "4m", target: "375w" },
        { duration: "4m", target: "180w" },
      ],
      rationale: {
        basis: "MAP",
        anchorWatts: 394,
        seedId: "custom-vo2",
        intensities: [
          { stepRef: "On", pct: 95 },
          { stepRef: "Off", pct: 45 },
        ],
      },
    });

    const rationale = extractRationale(result.description);
    expect(rationale).toEqual({
      basis: "MAP",
      anchorWatts: 394,
      seedId: "custom-vo2",
      intensities: [
        { stepRef: "On", pct: 95 },
        { stepRef: "Off", pct: 45 },
      ],
    });
  });

  it("omits rationale block when not provided", async () => {
    const api = fakeApi({
      listFolders: vi
        .fn()
        .mockResolvedValue([
          { id: 1, name: "Coach: Custom", type: "FOLDER", children: [] },
        ]),
    });
    api.createWorkout = vi.fn().mockResolvedValue({ id: 1, name: "X" });

    const result = await runCreate(api, builder, {
      name: "X",
      steps: [{ duration: "30m", target: "200w" }],
    });

    expect(extractRationale(result.description)).toBeNull();
  });
});
