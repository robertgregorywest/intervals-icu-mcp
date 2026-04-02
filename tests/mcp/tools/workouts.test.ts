import { describe, it, expect, vi } from "vitest";
import {
  createWorkout,
  createStrengthWorkout,
} from "../../../src/mcp/tools/workouts.js";
import type { IIntervalsClient } from "../../../src/index.js";
import { WorkoutBuilder } from "../../../src/services/workout-builder/index.js";
import type { IntervalsEvent } from "../../../src/types.js";

function createMockClient(
  returnEvents: IntervalsEvent[] = []
): IIntervalsClient {
  return {
    events: {
      getEvents: vi.fn().mockResolvedValue([]),
      getEvent: vi.fn().mockResolvedValue({}),
      createEvents: vi.fn().mockResolvedValue(returnEvents),
      updateEvent: vi.fn().mockResolvedValue({}),
      deleteEvent: vi.fn().mockResolvedValue(undefined),
      deleteEvents: vi.fn().mockResolvedValue(undefined),
    },
    workoutBuilder: new WorkoutBuilder(),
    athlete: { getAthlete: vi.fn().mockResolvedValue({}) },
    activities: {
      getActivities: vi.fn().mockResolvedValue([]),
      getActivity: vi.fn().mockResolvedValue({}),
      getActivityStreams: vi.fn().mockResolvedValue({}),
    },
    wellness: {
      getWellness: vi.fn().mockResolvedValue([]),
      getWellnessDay: vi.fn().mockResolvedValue({}),
    },
    powerCurves: { getPowerCurve: vi.fn().mockResolvedValue([]) },
    getEvents: vi.fn().mockResolvedValue([]),
    getEvent: vi.fn().mockResolvedValue({}),
    createEvents: vi.fn().mockResolvedValue(returnEvents),
    updateEvent: vi.fn().mockResolvedValue({}),
    deleteEvents: vi.fn().mockResolvedValue(undefined),
    getAthlete: vi.fn().mockResolvedValue({}),
    getActivities: vi.fn().mockResolvedValue([]),
    getActivity: vi.fn().mockResolvedValue({}),
    getActivityStreams: vi.fn().mockResolvedValue({}),
    getWellness: vi.fn().mockResolvedValue([]),
    getFitnessSummary: vi.fn().mockResolvedValue({}),
    getPowerCurve: vi.fn().mockResolvedValue([]),
    getAerobicDecoupling: vi.fn().mockResolvedValue({}),
    compareIntervals: vi
      .fn()
      .mockResolvedValue({ intervals: [], summaries: [] }),
  };
}

describe("createWorkout tool handler", () => {
  it("builds an event and calls createEvents", async () => {
    const returnedEvents: IntervalsEvent[] = [
      {
        id: 42,
        category: "WORKOUT",
        start_date_local: "2024-03-30T00:00:00",
        type: "Ride",
        name: "Threshold Intervals",
        description: "- Warmup 10m 60%\n\n3x\n- 4m 100%\n- 4m 55%",
      },
    ];
    const client = createMockClient(returnedEvents);

    const result = await createWorkout(client, {
      name: "Threshold Intervals",
      date: "2024-03-30",
      sportType: "Ride",
      steps: [
        { label: "Warmup", duration: "10m", target: "60%" },
        {
          iterations: 3,
          steps: [
            { duration: "4m", target: "100%" },
            { duration: "4m", target: "55%" },
          ],
        },
      ],
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.created).toBe(1);
    expect(parsed.events[0].name).toBe("Threshold Intervals");

    expect(client.createEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        category: "WORKOUT",
        type: "Ride",
        name: "Threshold Intervals",
        start_date_local: "2024-03-30T00:00:00",
        description: expect.stringContaining("- Warmup 10m 60%"),
      }),
    ]);
  });

  it("passes through externalId and color", async () => {
    const client = createMockClient([
      {
        id: 1,
        category: "WORKOUT",
        start_date_local: "2024-01-01T00:00:00",
        type: "Run",
        name: "Easy Run",
        description: "- 30m Z2",
      },
    ]);

    await createWorkout(client, {
      name: "Easy Run",
      date: "2024-01-01",
      sportType: "Run",
      steps: [{ duration: "30m", target: "Z2" }],
      externalId: "custom-123",
      color: "blue",
    });

    expect(client.createEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        external_id: "custom-123",
        color: "blue",
      }),
    ]);
  });
});

describe("createStrengthWorkout tool handler", () => {
  it("creates a WeightTraining event with free-form description", async () => {
    const returnedEvents: IntervalsEvent[] = [
      {
        id: 99,
        category: "WORKOUT",
        start_date_local: "2024-04-01T00:00:00",
        type: "WeightTraining",
        name: "Strength Session",
        description: "Box Squat 3×5 @ RPE 7\nTrap Bar Deadlift 3×5 @ RPE 8",
      },
    ];
    const client = createMockClient(returnedEvents);

    const result = await createStrengthWorkout(client, {
      name: "Strength Session",
      date: "2024-04-01",
      description: "Box Squat 3×5 @ RPE 7\nTrap Bar Deadlift 3×5 @ RPE 8",
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.created).toBe(1);
    expect(parsed.events[0].name).toBe("Strength Session");
    expect(parsed.events[0].description).toContain("Box Squat");

    expect(client.createEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        category: "WORKOUT",
        type: "WeightTraining",
        name: "Strength Session",
        start_date_local: "2024-04-01T00:00:00",
        description: "Box Squat 3×5 @ RPE 7\nTrap Bar Deadlift 3×5 @ RPE 8",
        external_id: "mcp-2024-04-01-strength-session",
      }),
    ]);
  });

  it("passes through externalId and color", async () => {
    const client = createMockClient([
      {
        id: 1,
        category: "WORKOUT",
        start_date_local: "2024-04-01T00:00:00",
        type: "WeightTraining",
        name: "Gym",
        description: "Squats 3×5",
      },
    ]);

    await createStrengthWorkout(client, {
      name: "Gym",
      date: "2024-04-01",
      description: "Squats 3×5",
      externalId: "gym-123",
      color: "red",
    });

    expect(client.createEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        external_id: "gym-123",
        color: "red",
      }),
    ]);
  });
});
