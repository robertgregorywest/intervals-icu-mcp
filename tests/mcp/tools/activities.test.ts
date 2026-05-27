import { describe, it, expect, vi } from "vitest";
import {
  getActivities,
  getActivity,
  getActivityStreams,
} from "../../../src/mcp/tools/activities.js";
import type { IIntervalsClient } from "../../../src/index.js";

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
  it("returns streams as JSON", async () => {
    const client = createMockClient();
    const result = await getActivityStreams(client, { id: "i1" });
    const parsed = result;

    expect(parsed.watts).toEqual([200, 210]);
    expect(client.getActivityStreams).toHaveBeenCalledWith("i1", undefined);
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
