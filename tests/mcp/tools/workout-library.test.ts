import { describe, it, expect, vi } from "vitest";
import {
  listWorkoutLibrary,
  getWorkoutLibraryItem,
  seedWorkoutLibrary,
  refreshWorkoutLibrary,
  createWorkoutLibraryItem,
} from "../../../src/mcp/tools/workout-library.js";
import type { IIntervalsClient } from "../../../src/index.js";

function createMockClient(): IIntervalsClient {
  return {
    workoutLibrary: {
      list: vi.fn().mockResolvedValue({
        folders: [{ id: 1, name: "Coach Templates", num_workouts: 1 }],
        workouts: [
          {
            id: 10,
            name: "VO2 4x4",
            type: "Ride",
            folder_id: 1,
            folder_name: "Coach Templates",
            stepCount: 8,
            totalSeconds: 1920,
            hasRationale: true,
            oneLine: "8 steps, 32m",
          },
        ],
      }),
      get: vi.fn().mockResolvedValue({
        workout: { id: 10, name: "VO2 4x4", description: "..." },
        description_text: "...",
        rationale: { basis: "MAP", anchorWatts: 380 },
        summary: {
          stepCount: 8,
          totalSeconds: 1920,
          hasRationale: true,
          oneLine: "8 steps, 32m",
        },
      }),
      seed: vi.fn().mockResolvedValue({
        dryRun: false,
        created: [
          {
            seedId: "vo2-4x4",
            name: "VO2 4×4",
            folder: "Coach Templates/VO2 Max",
            basis: "MAP",
            anchorWatts: 380,
            description: "...",
            workoutId: 1000,
          },
        ],
        skipped: [],
        warnings: [],
      }),
      refresh: vi.fn().mockResolvedValue({
        dryRun: false,
        updated: [
          {
            workoutId: 1000,
            name: "VO2 4×4",
            folder: "Coach: VO2 Max",
            seedId: "vo2-4x4",
            basis: "MAP",
            oldAnchorWatts: 380,
            newAnchorWatts: 394,
          },
        ],
        skipped: [],
        warnings: [],
      }),
      create: vi.fn().mockResolvedValue({
        workoutId: 999,
        name: "Custom VO2",
        folder: "Coach: Custom",
        description: "stub",
      }),
    },
  } as unknown as IIntervalsClient;
}

describe("listWorkoutLibrary handler", () => {
  it("delegates to client.workoutLibrary.list", async () => {
    const client = createMockClient();
    const result = await listWorkoutLibrary(client, {});
    expect(result.folders).toHaveLength(1);
    expect(result.workouts[0].name).toBe("VO2 4x4");
    expect(client.workoutLibrary.list).toHaveBeenCalledWith(undefined);
  });

  it("passes folder filter through", async () => {
    const client = createMockClient();
    await listWorkoutLibrary(client, { folder: "VO2" });
    expect(client.workoutLibrary.list).toHaveBeenCalledWith("VO2");
  });
});

describe("getWorkoutLibraryItem handler", () => {
  it("delegates to client.workoutLibrary.get", async () => {
    const client = createMockClient();
    const result = (await getWorkoutLibraryItem(client, { id: 10 })) as {
      rationale: { basis: string };
    };
    expect(result.rationale.basis).toBe("MAP");
    expect(client.workoutLibrary.get).toHaveBeenCalledWith(10);
  });
});

describe("seedWorkoutLibrary handler", () => {
  it("forwards anchors and dryRun to client.workoutLibrary.seed", async () => {
    const client = createMockClient();
    const result = await seedWorkoutLibrary(client, {
      mapWatts: 380,
      ftpWatts: 290,
      dryRun: true,
    });
    expect(result.created).toHaveLength(1);
    expect(client.workoutLibrary.seed).toHaveBeenCalledWith({
      mapWatts: 380,
      ftpWatts: 290,
      dryRun: true,
    });
  });
});

describe("refreshWorkoutLibrary handler", () => {
  it("forwards anchors to client.workoutLibrary.refresh", async () => {
    const client = createMockClient();
    const result = await refreshWorkoutLibrary(client, { mapWatts: 394 });
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].newAnchorWatts).toBe(394);
    expect(client.workoutLibrary.refresh).toHaveBeenCalledWith({
      mapWatts: 394,
    });
  });
});

describe("createWorkoutLibraryItem handler", () => {
  it("forwards the input to client.workoutLibrary.create", async () => {
    const client = createMockClient();
    const result = await createWorkoutLibraryItem(client, {
      name: "Custom VO2",
      folder: "Coach: Custom",
      steps: [{ duration: "4m", target: "375w" }],
    });
    expect(result.workoutId).toBe(999);
    expect(client.workoutLibrary.create).toHaveBeenCalledWith({
      name: "Custom VO2",
      folder: "Coach: Custom",
      steps: [{ duration: "4m", target: "375w" }],
    });
  });
});
