import { describe, it, expect, vi } from "vitest";
import { createWorkout } from "../../../src/mcp/tools/workouts.js";
import type { IIntervalsClient } from "../../../src/index.js";
import { WorkoutBuilder } from "../../../src/services/workout-builder/index.js";
import type { IntervalsEvent } from "../../../src/types.js";

function createMockClient(
  returnEvents: IntervalsEvent[] = [],
): IIntervalsClient {
  return {
    events: {
      createEvents: vi.fn().mockResolvedValue(returnEvents),
      deleteEvents: vi.fn().mockResolvedValue(undefined),
    },
    workoutBuilder: new WorkoutBuilder(),
    createEvents: vi.fn().mockResolvedValue(returnEvents),
    deleteEvents: vi.fn().mockResolvedValue(undefined),
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
