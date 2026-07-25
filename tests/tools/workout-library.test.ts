import { describe, it, expect, vi } from "vitest";
import {
  listWorkoutLibrary,
  getWorkoutLibraryItem,
  syncWorkoutLibrary,
} from "../../src/tools/workout-library.js";
import type { IIntervalsClient } from "../../src/index.js";

function createMockClient(): IIntervalsClient {
  return {
    listWorkoutLibrary: vi.fn().mockResolvedValue({
      folders: [{ id: 1, name: "Coach: VO2 Max", num_workouts: 1 }],
      workouts: [
        {
          id: 10,
          name: "VO2 4x4",
          type: "Ride",
          folder_id: 1,
          folder_name: "Coach: VO2 Max",
          stepCount: 8,
          totalSeconds: 1920,
          hasTemplate: true,
          purpose: "Default VO2 session.",
          oneLine: "8 steps, 32m",
        },
      ],
    }),
    getWorkoutLibraryItem: vi.fn().mockResolvedValue({
      workout: { id: 10, name: "VO2 4x4", description: "..." },
      description_text: "...",
      seedId: "vo2-4x4",
      summary: {
        stepCount: 8,
        totalSeconds: 1920,
        hasTemplate: true,
        oneLine: "8 steps, 32m",
      },
    }),
    syncWorkoutLibrary: vi.fn().mockResolvedValue({
      dryRun: true,
      created: [{ seedId: "openers", name: "Openers", folder: "Coach: Race" }],
      updated: [
        {
          seedId: "vo2-4x4",
          name: "VO2 4×4",
          folder: "Coach: VO2 Max",
          workoutId: 10,
          changed: ["description"],
        },
      ],
      unchanged: [],
      skipped: [],
      orphans: [],
      warnings: [],
    }),
  } as unknown as IIntervalsClient;
}

describe("listWorkoutLibrary handler", () => {
  it("delegates to client.listWorkoutLibrary", async () => {
    const client = createMockClient();
    const result = await listWorkoutLibrary(client, {});
    expect(result.folders).toHaveLength(1);
    expect(result.workouts[0].name).toBe("VO2 4x4");
    expect(client.listWorkoutLibrary).toHaveBeenCalledWith(undefined);
  });

  it("surfaces purpose so the coach can select by intent", async () => {
    const client = createMockClient();
    const result = await listWorkoutLibrary(client, {});
    expect(result.workouts[0].purpose).toBe("Default VO2 session.");
    expect(result.workouts[0].hasTemplate).toBe(true);
  });

  it("passes folder filter through", async () => {
    const client = createMockClient();
    await listWorkoutLibrary(client, { folder: "VO2" });
    expect(client.listWorkoutLibrary).toHaveBeenCalledWith("VO2");
  });
});

describe("getWorkoutLibraryItem handler", () => {
  it("delegates to client.getWorkoutLibraryItem", async () => {
    const client = createMockClient();
    const result = (await getWorkoutLibraryItem(client, { id: 10 })) as {
      seedId: string;
    };
    expect(result.seedId).toBe("vo2-4x4");
    expect(client.getWorkoutLibraryItem).toHaveBeenCalledWith(10);
  });
});

describe("syncWorkoutLibrary handler", () => {
  it("forwards anchors and dryRun to client.syncWorkoutLibrary", async () => {
    const client = createMockClient();
    const result = await syncWorkoutLibrary(client, {
      mapWatts: 415,
      ftpWatts: 290,
      dryRun: true,
    });
    expect(result.created).toHaveLength(1);
    expect(result.updated[0].changed).toEqual(["description"]);
    expect(client.syncWorkoutLibrary).toHaveBeenCalledWith({
      mapWatts: 415,
      ftpWatts: 290,
      dryRun: true,
    });
  });
});
