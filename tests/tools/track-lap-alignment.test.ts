import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  computeTrackLapPower,
  computeTrackLapPowerSchema,
  computeTrackLapPowerOutputSchema,
} from "../../src/tools/track-lap-alignment.js";
import { createTrackLapAlignment } from "../../src/services/track-lap-alignment/index.js";
import type { IIntervalsClient } from "../../src/index.js";
import type { IActivitiesApi } from "../../src/services/activities/index.js";
import type { ActivityStreams } from "../../src/services/activities/types.js";
import type { TrackLapPowerOptions } from "../../src/services/track-lap-alignment/index.js";

function read(name: string) {
  return readFileSync(
    fileURLToPath(
      new URL(`../fixtures/track-lap-alignment/${name}`, import.meta.url)
    ),
    "utf8"
  );
}

const SESSION = JSON.parse(read("track-session-2026-08-08.json"));
const SPLITS = read("splits-2026-08-08.csv");

function clientWithStreams(): {
  client: IIntervalsClient;
  requested: string[];
} {
  const requested: string[] = [];
  const activitiesApi: IActivitiesApi = {
    getActivities: async () => [],
    getActivity: async () => {
      throw new Error("not used");
    },
    getActivityLaps: async () => null,
    getActivityStreams: async (id) => {
      requested.push(id);
      return {
        time: SESSION.time,
        watts: SESSION.watts,
        cadence: SESSION.cadence,
        heartrate: SESSION.heartrate,
      } as ActivityStreams;
    },
  };
  const service = createTrackLapAlignment({ activitiesApi });
  const client = {
    computeTrackLapPower: (options: TrackLapPowerOptions) =>
      service.computeTrackLapPower(options),
  } as unknown as IIntervalsClient;
  return { client, requested };
}

describe("compute_track_lap_power", () => {
  it("returns a result its own output schema accepts", async () => {
    const { client } = clientWithStreams();
    const result = await computeTrackLapPower(client, {
      activityId: "i173732945",
      splits: SPLITS,
    });

    expect(() => computeTrackLapPowerOutputSchema.parse(result)).not.toThrow();
    expect(result.runs).toHaveLength(4);
    expect(result.runs[0].average.watts).toBe(376);
    expect(result.runs[1].average.watts).toBe(380);
  });

  it("accepts a bare numeric activity id", async () => {
    const { client, requested } = clientWithStreams();
    await computeTrackLapPower(client, {
      activityId: 173732945,
      splits: SPLITS,
    });
    expect(requested).toEqual(["i173732945"]);
  });

  it("leaves an already-prefixed id alone", async () => {
    const { client, requested } = clientWithStreams();
    await computeTrackLapPower(client, {
      activityId: "i173732945",
      splits: SPLITS,
    });
    expect(requested).toEqual(["i173732945"]);
  });

  it("requires an activity id and splits", () => {
    expect(computeTrackLapPowerSchema.safeParse({}).success).toBe(false);
    expect(
      computeTrackLapPowerSchema.safeParse({ activityId: "i1" }).success
    ).toBe(false);
    expect(
      computeTrackLapPowerSchema.safeParse({ activityId: "i1", splits: "x" })
        .success
    ).toBe(true);
  });

  it("rejects a non-positive lap distance at the boundary", () => {
    expect(
      computeTrackLapPowerSchema.safeParse({
        activityId: "i1",
        splits: "x",
        lapDistanceMeters: 0,
      }).success
    ).toBe(false);
  });

  it("passes a custom lap distance through", async () => {
    const { client } = clientWithStreams();
    const relabelled = SPLITS.split("\n")
      .map((line, i) => {
        if (i === 0 || !line.trim()) return line;
        const cells = line.split(",");
        cells[1] = ((Number(cells[1]) / 250) * 333.33).toFixed(2);
        return cells.join(",");
      })
      .join("\n");

    const result = await computeTrackLapPower(client, {
      activityId: "i173732945",
      splits: relabelled,
      lapDistanceMeters: 333.33,
    });
    expect(result.lapDistanceMeters).toBe(333.33);
  });

  it("surfaces a split-record error to the caller", async () => {
    const { client } = clientWithStreams();
    await expect(
      computeTrackLapPower(client, {
        activityId: "i173732945",
        splits: "1,250,16.26,16.26\n1,500,32.69,17.43\n",
      })
    ).rejects.toThrow(/does not reconcile/);
  });
});
