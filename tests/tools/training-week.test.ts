import { describe, it, expect, vi } from "vitest";
import { getTrainingWeekSummary } from "../../src/tools/training-week.js";
import type { IIntervalsClient } from "../../src/index.js";

function createMockClient(): IIntervalsClient {
  return {
    getActivities: vi.fn().mockResolvedValue([
      {
        id: "i1",
        start_date_local: "2026-04-27T07:00:00",
        type: "Ride",
        name: "Endurance Ride",
        source: "WAHOO",
        icu_training_load: 80,
        moving_time: 5400,
        distance: 45000,
        icu_average_watts: 180,
        average_heartrate: 138,
      },
      {
        id: "i2",
        start_date_local: "2026-04-29T18:00:00",
        type: "Run",
        name: "Easy Run",
        source: "GARMIN",
        icu_training_load: 40,
        moving_time: 1800,
        distance: 6000,
      },
    ]),
    getWellness: vi.fn().mockResolvedValue([
      { id: "2026-04-27", ctl: 50, atl: 45 },
      { id: "2026-05-03", ctl: 53, atl: 50 },
    ]),
    getEvents: vi.fn().mockResolvedValue([
      {
        id: 99,
        start_date_local: "2026-05-02T00:00:00",
        category: "WORKOUT",
        type: "Ride",
        name: "Sweet Spot",
      },
    ]),
  } as unknown as IIntervalsClient;
}

describe("getTrainingWeekSummary tool handler", () => {
  it("composes activities + wellness + events into a summary", async () => {
    const client = createMockClient();
    const result = await getTrainingWeekSummary(client, {
      weekStart: "2026-04-27",
    });
    const parsed = result;

    expect(parsed.week).toEqual({ start: "2026-04-27", end: "2026-05-03" });
    expect(parsed.totals.activity_count).toBe(2);
    expect(parsed.totals.tss).toBe(120);
    expect(parsed.totals.duration_hours).toBe(2);
    expect(parsed.by_sport.Ride).toEqual({ count: 1, tss: 80, hours: 1.5 });
    expect(parsed.by_sport.Run).toEqual({ count: 1, tss: 40, hours: 0.5 });
    expect(parsed.fitness.ctl).toEqual({ start: 50, end: 53, delta: 3 });
    expect(parsed.fitness.tsb).toEqual({ start: 5, end: 3 });
    expect(parsed.completed_activities).toHaveLength(2);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].name).toBe("Sweet Spot");

    expect(client.getActivities).toHaveBeenCalledWith(
      "2026-04-27",
      "2026-05-03"
    );
    expect(client.getWellness).toHaveBeenCalledWith("2026-04-27", "2026-05-03");
    expect(client.getEvents).toHaveBeenCalledWith("2026-04-27", "2026-05-03");
  });

  it("defaults weekStart to current Monday when omitted", async () => {
    const client = createMockClient();
    await getTrainingWeekSummary(client, {});

    const [oldest, newest] = (client.getActivities as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(oldest).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(newest).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const startDay = new Date(`${oldest}T00:00:00Z`).getUTCDay();
    expect(startDay).toBe(1);
  });

  it("returns null fitness when wellness is empty", async () => {
    const client = createMockClient();
    (client.getWellness as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const result = await getTrainingWeekSummary(client, {
      weekStart: "2026-04-27",
    });
    const parsed = result;

    expect(parsed.fitness).toBeNull();
  });
});
