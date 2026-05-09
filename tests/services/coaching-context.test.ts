import { describe, it, expect } from "vitest";
import { buildCoachingContext } from "../../src/services/coaching-context/coaching-context.js";
import type {
  AthleteProfile,
  IAthleteApi,
} from "../../src/services/athlete/index.js";
import type {
  IWellnessApi,
  WellnessRecord,
} from "../../src/services/wellness/index.js";
import type {
  Activity,
  ActivityStreams,
  IActivitiesApi,
} from "../../src/services/activities/index.js";

function fakeAthleteApi(profile: Partial<AthleteProfile>): IAthleteApi {
  return {
    getAthlete: async () => profile as AthleteProfile,
  };
}

function fakeWellnessApi(records: Partial<WellnessRecord>[]): IWellnessApi {
  return {
    getWellness: async () => records as WellnessRecord[],
    getWellnessDay: async () => records[0] as WellnessRecord,
  };
}

function fakeActivitiesApi(
  activities: Partial<Activity>[] = [],
  streamsById: Record<string, Partial<ActivityStreams>> = {}
): IActivitiesApi {
  return {
    getActivities: async () => activities as Activity[],
    getActivity: async (id) => {
      const found = activities.find((a) => String(a.id) === String(id));
      return (found ?? {}) as Activity;
    },
    getActivityStreams: async (id) =>
      (streamsById[String(id)] ?? {}) as ActivityStreams,
  };
}

function makeRampStream(secs: number, peakStartIdx: number): number[] {
  // Constant 100 W background; peak window of 60s at 394 W.
  const stream = new Array(secs).fill(100);
  for (let i = peakStartIdx; i < peakStartIdx + 60 && i < secs; i++) {
    stream[i] = 394;
  }
  return stream;
}

describe("buildCoachingContext", () => {
  it("synthesises athlete + wellness into one snapshot", async () => {
    const athleteApi = fakeAthleteApi({
      id: "i1",
      name: "Test",
      weight: 72,
      ftp: 285,
      lthr: 168,
      max_hr: 192,
      resting_hr: 48,
      sport_settings: [
        {
          types: ["Ride", "VirtualRide"],
          ftp: 285,
          lthr: 168,
          max_hr: 192,
          threshold_pace: 0,
          power_zones: [
            { id: 1, name: "Z1", min: 0, max: 150 },
            { id: 2, name: "Z2", min: 150, max: 220 },
          ],
          hr_zones: [
            { id: 1, name: "Z1", min: 0, max: 130 },
            { id: 2, name: "Z2", min: 130, max: 150 },
          ],
          pace_zones: [],
        },
      ],
    });
    const wellnessApi = fakeWellnessApi([
      { id: "2026-04-28", ctl: 60, atl: 55, fatigue: 3 } as WellnessRecord,
      { id: "2026-04-29", ctl: 62, atl: 58, fatigue: 4 } as WellnessRecord,
      { id: "2026-04-30", ctl: 64, atl: 50, fatigue: 2 } as WellnessRecord,
    ]);
    const activitiesApi = fakeActivitiesApi();

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { days: 3, today: "2026-04-30" }
    );

    expect(ctx.asOf).toBe("2026-04-30");
    expect(ctx.daysWindow).toBe(3);
    expect(ctx.athlete.ftp).toBe(285);
    expect(ctx.athlete.power_zones).toHaveLength(2);
    expect(ctx.athlete.hr_zones).toHaveLength(2);
    expect(ctx.athlete.pace_zones).toBeNull();
    expect(ctx.fitness).toEqual({
      date: "2026-04-30",
      ctl: 64,
      atl: 50,
      tsb: 14,
      ramp_rate: round1((64 - 60) / 3),
    });
    expect(ctx.wellnessTrend).toHaveLength(3);
    expect(ctx.wellnessTrend[0].date).toBe("2026-04-28");
    expect(ctx.wellnessTrend[2].fatigue).toBe(2);
  });

  it("handles missing fields and empty wellness window", async () => {
    const athleteApi = fakeAthleteApi({ id: "i2" });
    const wellnessApi = fakeWellnessApi([]);
    const activitiesApi = fakeActivitiesApi();

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { today: "2026-05-01" }
    );

    expect(ctx.daysWindow).toBe(7);
    expect(ctx.athlete.ftp).toBeNull();
    expect(ctx.athlete.power_zones).toBeNull();
    expect(ctx.athlete.sport_settings_count).toBe(0);
    expect(ctx.fitness).toEqual({
      date: null,
      ctl: null,
      atl: null,
      tsb: null,
      ramp_rate: null,
    });
    expect(ctx.wellnessTrend).toEqual([]);
  });

  it("falls back to icu_-prefixed fields and sportSettings camelCase", async () => {
    const athleteApi = fakeAthleteApi({
      id: "i3",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({
        icu_ftp: 300,
        icu_lthr: 170,
        sportSettings: [
          {
            types: ["Run"],
            ftp: 0,
            lthr: 170,
            max_hr: 188,
            threshold_pace: 4,
            power_zones: [],
            hr_zones: [],
            pace_zones: [{ id: 1, name: "Easy", min: 0, max: 60 }],
          },
        ],
      } as any),
    });
    const wellnessApi = fakeWellnessApi([
      { id: "2026-05-01", ctl: 50, atl: 50 } as WellnessRecord,
    ]);
    const activitiesApi = fakeActivitiesApi();

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { today: "2026-05-01", days: 1 }
    );

    expect(ctx.athlete.ftp).toBe(300);
    expect(ctx.athlete.lthr).toBe(170);
    expect(ctx.athlete.pace_zones).toEqual([
      { id: 1, name: "Easy", min: 0, max: 60 },
    ]);
    expect(ctx.athlete.sport_settings_count).toBe(1);
  });

  it("rejects out-of-range days", async () => {
    const athleteApi = fakeAthleteApi({});
    const wellnessApi = fakeWellnessApi([]);
    const activitiesApi = fakeActivitiesApi();

    await expect(
      buildCoachingContext(
        { athleteApi, wellnessApi, activitiesApi },
        { days: 0 }
      )
    ).rejects.toThrow(/days must be >= 1/);
    await expect(
      buildCoachingContext(
        { athleteApi, wellnessApi, activitiesApi },
        { days: 31 }
      )
    ).rejects.toThrow(/days must be <= 30/);
  });
});

describe("buildCoachingContext — MAP derivation", () => {
  const athleteApi = fakeAthleteApi({ id: "i1" });
  const wellnessApi = fakeWellnessApi([]);

  it("derives MAP from the most recent ramp test", async () => {
    const stream = makeRampStream(1000, 800);
    const activitiesApi = fakeActivitiesApi(
      [
        {
          id: 7777,
          name: "MAP ramp test",
          start_date_local: "2026-03-15T10:00:00",
        } as Activity,
      ],
      { "7777": { watts: stream } }
    );

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { today: "2026-05-09" }
    );

    expect(ctx.map).not.toBeNull();
    expect(ctx.map?.watts).toBe(394);
    expect(ctx.map?.computedFrom).toEqual({
      metric: "best_60s",
      activityId: 7777,
      activityName: "MAP ramp test",
      activityDate: "2026-03-15",
      daysAgo: 55,
    });
    expect(ctx.mapWarning).toBeUndefined();
  });

  it("picks the most recent when multiple ramp tests are in the window", async () => {
    const oldStream = makeRampStream(800, 600);
    const oldStream360 = oldStream.map((v) => (v === 394 ? 360 : v));
    const newStream = makeRampStream(900, 700);
    const activitiesApi = fakeActivitiesApi(
      [
        {
          id: "old",
          name: "MAP ramp test 2026-02-01",
          start_date_local: "2026-02-01T09:00:00",
        } as unknown as Activity,
        {
          id: "new",
          name: "MAP ramp test 2026-04-12",
          start_date_local: "2026-04-12T09:00:00",
        } as unknown as Activity,
      ],
      {
        old: { watts: oldStream360 },
        new: { watts: newStream },
      }
    );

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { today: "2026-05-09" }
    );

    expect(ctx.map?.watts).toBe(394);
    expect(ctx.map?.computedFrom.activityId).toBe("new");
    expect(ctx.map?.computedFrom.daysAgo).toBe(27);
  });

  it("excludes activities whose name contains (skip)", async () => {
    const goodStream = makeRampStream(800, 600);
    const skipStream = makeRampStream(800, 600).map((v) =>
      v === 394 ? 250 : v
    );
    const activitiesApi = fakeActivitiesApi(
      [
        {
          id: "skip",
          name: "MAP ramp test (skip)",
          start_date_local: "2026-04-25T09:00:00",
        } as unknown as Activity,
        {
          id: "good",
          name: "MAP ramp test",
          start_date_local: "2026-03-15T09:00:00",
        } as unknown as Activity,
      ],
      {
        skip: { watts: skipStream },
        good: { watts: goodStream },
      }
    );

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { today: "2026-05-09" }
    );

    expect(ctx.map?.watts).toBe(394);
    expect(ctx.map?.computedFrom.activityId).toBe("good");
  });

  it("returns null + warning when no ramp test is in the 90-day window", async () => {
    const activitiesApi = fakeActivitiesApi([
      {
        id: 1,
        name: "Morning Ride",
        start_date_local: "2026-04-12T09:00:00",
      } as Activity,
    ]);

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { today: "2026-05-09" }
    );

    expect(ctx.map).toBeNull();
    expect(ctx.mapWarning).toMatch(/90 days/);
    expect(ctx.mapWarning).toMatch(/MAP/);
  });

  it("returns null + warning when matching activity has no power data", async () => {
    const activitiesApi = fakeActivitiesApi(
      [
        {
          id: 42,
          name: "MAP ramp test",
          start_date_local: "2026-04-20T09:00:00",
        } as Activity,
      ],
      { "42": {} }
    );

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { today: "2026-05-09" }
    );

    expect(ctx.map).toBeNull();
    expect(ctx.mapWarning).toMatch(/no power data/i);
    expect(ctx.mapWarning).toMatch(/MAP ramp test/);
    expect(ctx.mapWarning).toMatch(/2026-04-20/);
  });

  it("only matches names with the prefix, not anywhere", async () => {
    const stream = makeRampStream(800, 600);
    const activitiesApi = fakeActivitiesApi(
      [
        {
          id: "noisy",
          name: "Morning Ride after MAP ramp test",
          start_date_local: "2026-04-15T09:00:00",
        } as unknown as Activity,
      ],
      { noisy: { watts: stream } }
    );

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { today: "2026-05-09" }
    );

    expect(ctx.map).toBeNull();
    expect(ctx.mapWarning).toMatch(/90 days/);
  });

  it("matches case-insensitively", async () => {
    const stream = makeRampStream(800, 600);
    const activitiesApi = fakeActivitiesApi(
      [
        {
          id: "lower",
          name: "map ramp test #4",
          start_date_local: "2026-04-15T09:00:00",
        } as unknown as Activity,
      ],
      { lower: { watts: stream } }
    );

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { today: "2026-05-09" }
    );

    expect(ctx.map?.watts).toBe(394);
  });

  it("returns null + warning when getActivities throws", async () => {
    const activitiesApi: IActivitiesApi = {
      getActivities: async () => {
        throw new Error("boom");
      },
      getActivity: async () => ({}) as Activity,
      getActivityStreams: async () => ({}) as ActivityStreams,
    };

    const ctx = await buildCoachingContext(
      { athleteApi, wellnessApi, activitiesApi },
      { today: "2026-05-09" }
    );

    expect(ctx.map).toBeNull();
    expect(ctx.mapWarning).toMatch(/MAP/);
  });
});

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
