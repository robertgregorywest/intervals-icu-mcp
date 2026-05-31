import { describe, it, expect, vi } from "vitest";
import {
  getActivities,
  getActivity,
  getActivityStreams,
} from "../../src/tools/activities.js";
import type { IIntervalsClient } from "../../src/index.js";

function createMockClient(
  overrides: Partial<IIntervalsClient> = {}
): IIntervalsClient {
  return {
    getActivities: vi
      .fn()
      .mockResolvedValue([
        { id: "i1", name: "Morning Ride", icu_training_load: 65 },
      ]),
    getActivity: vi.fn().mockResolvedValue({
      id: "i1",
      name: "Morning Ride",
      icu_intervals: [],
    }),
    getActivityStreams: vi.fn().mockResolvedValue({
      watts: [200, 210],
      heartrate: [130, 135],
    }),
    ...overrides,
  } as unknown as IIntervalsClient;
}

describe("getActivities tool handler", () => {
  it("returns activities as JSON", async () => {
    const client = createMockClient();
    const result = await getActivities(client, {
      oldest: "2024-01-01",
      newest: "2024-01-31",
    });
    const parsed = result;

    expect(parsed.total).toBe(1);
    expect(parsed.count).toBe(1);
    expect(parsed.truncated).toBe(false);
    expect(parsed.activities[0].name).toBe("Morning Ride");
    expect(client.getActivities).toHaveBeenCalledWith(
      "2024-01-01",
      "2024-01-31"
    );
  });
});

describe("getActivity tool handler", () => {
  it("returns single activity as JSON", async () => {
    const client = createMockClient();
    const result = await getActivity(client, { id: "i1" });
    const parsed = result;

    expect(parsed.name).toBe("Morning Ride");
    expect(client.getActivity).toHaveBeenCalledWith("i1", undefined);
  });

  it("normalizes bare number to i-prefixed string", async () => {
    const client = createMockClient();
    await getActivity(client, { id: 1 });

    expect(client.getActivity).toHaveBeenCalledWith("i1", undefined);
  });

  it("passes includeIntervals flag", async () => {
    const client = createMockClient();
    await getActivity(client, { id: "i1", includeIntervals: true });

    expect(client.getActivity).toHaveBeenCalledWith("i1", true);
  });

  it("compacts interval analysis so a 4x2min block is discoverable", async () => {
    const client = createMockClient({
      getActivity: vi.fn().mockResolvedValue({
        id: "i149578078",
        name: "Pursuit sharpening — 4 × 2min",
        icu_average_watts: 164,
        interval_summary: ["1x 4m 151w", "4x 2m 369w", "1x 10m8s 111w"],
        icu_intervals: [
          {
            type: "WORK",
            label: null,
            start_time: 1294,
            elapsed_time: 120,
            average_watts: 383,
            max_watts: 427,
            average_heartrate: 142,
            average_cadence: 91,
            group_id: "120s@369w91rpm",
            // noise fields that must be dropped from the projection
            average_smo2: null,
            average_wind_speed: 5.5,
            tailwind_percent: 29,
          },
          {
            type: "RECOVERY",
            label: null,
            start_time: 2494,
            elapsed_time: 266,
            average_watts: 123,
            max_watts: 255,
            average_heartrate: 130,
            average_cadence: 60,
            group_id: null,
          },
        ],
        icu_groups: [
          {
            id: "120s@369w91rpm",
            count: 4,
            elapsed_time: 120,
            average_watts: 369,
            max_watts: 462,
            average_heartrate: 142,
            average_cadence: 91,
            average_lactate: null,
          },
        ],
      }),
    });

    const result = (await getActivity(client, {
      id: "i149578078",
      includeIntervals: true,
    })) as {
      name: string;
      icu_average_watts: number;
      icu_intervals?: unknown;
      icu_groups?: unknown;
      interval_summary: string[];
      groups: Array<Record<string, unknown>>;
      intervals: Array<Record<string, unknown>>;
    };

    // Grouped structure is front and centre.
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({
      sig: "120s@369w91rpm",
      count: 4,
      avgW: 369,
      dur: 120,
    });
    expect(result.interval_summary).toContain("4x 2m 369w");

    // Per-lap detail is slim and links to its group via grp.
    expect(result.intervals).toHaveLength(2);
    expect(result.intervals[0]).toMatchObject({
      i: 0,
      type: "WORK",
      avgW: 383,
      grp: "120s@369w91rpm",
    });
    // Recovery lap has no group_id, so grp is omitted.
    expect(result.intervals[1].grp).toBeUndefined();

    // Raw blobs and their ~70 noise fields are gone; other activity fields stay.
    expect(result.icu_intervals).toBeUndefined();
    expect(result.icu_groups).toBeUndefined();
    expect("average_smo2" in result.intervals[0]).toBe(false);
    expect(result.icu_average_watts).toBe(164);
    expect(result.name).toBe("Pursuit sharpening — 4 × 2min");
  });

  it("surfaces Strava stub as a structured limitation message", async () => {
    const client = createMockClient({
      getActivity: vi.fn().mockResolvedValue({
        id: "i999",
        source: "STRAVA",
        start_date_local: "2026-05-20T08:00:00",
        _note: "STRAVA activities are not available via the API",
      }),
    });
    const result = (await getActivity(client, { id: "i999" })) as Record<
      string,
      unknown
    >;

    expect(result._strava_limitation).toBe(true);
    expect(typeof result.message).toBe("string");
  });
});

describe("getActivityStreams tool handler", () => {
  it("returns streams in a packed envelope, full resolution when small", async () => {
    const client = createMockClient();
    const result = (await getActivityStreams(client, {
      id: "i1",
    })) as {
      samples: number;
      original_samples: number;
      downsampled: boolean;
      stride: number;
      streams: Record<string, number[]>;
    };

    expect(result.downsampled).toBe(false);
    expect(result.stride).toBe(1);
    expect(result.samples).toBe(2);
    expect(result.original_samples).toBe(2);
    expect(result.streams.watts).toEqual([200, 210]);
    expect(client.getActivityStreams).toHaveBeenCalledWith("i1", undefined);
  });

  it("downsamples large streams to fit the budget, preserving coverage", async () => {
    const watts = Array.from({ length: 20000 }, (_, i) => i);
    const heartrate = Array.from({ length: 20000 }, (_, i) => 100 + (i % 60));
    const client = createMockClient({
      getActivityStreams: vi.fn().mockResolvedValue({ watts, heartrate }),
    });

    const result = (await getActivityStreams(client, { id: "i1" })) as {
      samples: number;
      original_samples: number;
      downsampled: boolean;
      stride: number;
      streams: Record<string, number[]>;
    };

    expect(result.downsampled).toBe(true);
    expect(result.stride).toBeGreaterThan(1);
    expect(result.original_samples).toBe(20000);
    expect(result.samples).toBeLessThan(20000);
    // First sample is kept (index 0) and arrays stay aligned across streams.
    expect(result.streams.watts[0]).toBe(0);
    expect(result.streams.watts.length).toBe(result.streams.heartrate.length);
    expect(
      JSON.stringify({ streams: result.streams }).length
    ).toBeLessThanOrEqual(40_000);
  });

  it("normalizes bare number to i-prefixed string", async () => {
    const client = createMockClient();
    await getActivityStreams(client, { id: 1 });

    expect(client.getActivityStreams).toHaveBeenCalledWith("i1", undefined);
  });

  it("passes types filter", async () => {
    const client = createMockClient();
    await getActivityStreams(client, { id: "i1", types: ["watts"] });

    expect(client.getActivityStreams).toHaveBeenCalledWith("i1", ["watts"]);
  });
});
