import { describe, it, expect, vi } from "vitest";
import { getTrainingWeekSummary } from "../../src/tools/training-week.js";
import type { IIntervalsClient } from "../../src/index.js";

describe("getTrainingWeekSummary tool handler", () => {
  it("delegates to the client with the given weekStart", async () => {
    const summary = {
      week: { start: "2026-04-27", end: "2026-05-03" },
      totals: {
        activityCount: 2,
        tss: 120,
        durationSeconds: 7200,
        durationHours: 2,
      },
      bySport: {},
      fitness: null,
      completedActivities: [],
      events: [],
    };
    const client = {
      getTrainingWeekSummary: vi.fn().mockResolvedValue(summary),
    } as unknown as IIntervalsClient;

    const result = await getTrainingWeekSummary(client, {
      weekStart: "2026-04-27",
    });

    expect(result).toBe(summary);
    expect(client.getTrainingWeekSummary).toHaveBeenCalledWith("2026-04-27");
  });

  it("passes undefined through when weekStart is omitted", async () => {
    const client = {
      getTrainingWeekSummary: vi.fn().mockResolvedValue({
        week: { start: "2026-04-27", end: "2026-05-03" },
        totals: {
          activityCount: 0,
          tss: 0,
          durationSeconds: 0,
          durationHours: 0,
        },
        bySport: {},
        fitness: null,
        completedActivities: [],
        events: [],
      }),
    } as unknown as IIntervalsClient;

    await getTrainingWeekSummary(client, {});

    expect(client.getTrainingWeekSummary).toHaveBeenCalledWith(undefined);
  });
});
