import { describe, it, expect } from "vitest";
import { createExecutionDigest } from "../../../src/services/execution-digest/index.js";
import type { IEventsApi } from "../../../src/services/events/index.js";
import type {
  ISessionReview,
  PlannedVsActualResult,
  AlignedStep,
} from "../../../src/services/session-review/types.js";
import type {
  IIntensityDistribution,
  IntensityDistributionRangeResult,
} from "../../../src/services/intensity-distribution/types.js";
import type { IntervalsEvent, PlannedDocStep } from "../../../src/types.js";
import type {
  Activity,
  IActivitiesApi,
} from "../../../src/services/activities/index.js";

const FTP = 300;
/** 88% of 300 W — the key-session floor these fixtures are built around. */
const FLOOR = 264;

function event(
  id: number,
  name: string,
  steps: PlannedDocStep[],
  date = "2026-09-08"
): IntervalsEvent {
  return {
    id,
    name,
    category: "WORKOUT",
    type: "Ride",
    start_date_local: `${date}T00:00:00`,
    description: "",
    icu_ftp: FTP,
    workout_doc: { steps },
  } as IntervalsEvent;
}

function step(
  text: string,
  watts: number,
  duration = 300,
  cadence?: number
): PlannedDocStep {
  return {
    text,
    duration,
    power: { units: "w", value: watts },
    ...(cadence ? { cadence: { units: "rpm", value: cadence } } : {}),
  } as PlannedDocStep;
}

function aligned(over: Partial<AlignedStep> & { index: number }): AlignedStep {
  return {
    planned: {},
    verdict: "on-target",
    verdictBasis: "average-watts",
    ...over,
  } as AlignedStep;
}

function review(
  over: Partial<PlannedVsActualResult> & { eventId: number }
): PlannedVsActualResult {
  return {
    tolerance: 0.05,
    executionRecord: "device-laps",
    alignmentBasis: "sequential",
    matchedFraction: 1,
    steps: [],
    rollup: { unplannedIntervals: [] },
    ...over,
  } as PlannedVsActualResult;
}

interface Harness {
  events: IntervalsEvent[];
  reviews?: Record<number, PlannedVsActualResult>;
  range?: Partial<IntensityDistributionRangeResult>;
  ftp?: number | null;
  /** Rides in the widened window, paired to events by `paired_event_id`. */
  rides?: Partial<Activity>[];
}

function digest(h: Harness) {
  const calls: {
    eventIds: number[];
    ranges: string[];
    rideRanges: string[];
    athleteFtpReads: number;
  } = {
    eventIds: [],
    ranges: [],
    rideRanges: [],
    athleteFtpReads: 0,
  };

  const activitiesApi = {
    getActivities: async (oldest: string, newest: string) => {
      calls.rideRanges.push(`${oldest}..${newest}`);
      return (h.rides ?? []) as Activity[];
    },
  } as unknown as IActivitiesApi;

  const eventsApi = {
    getEvents: async () => h.events,
  } as unknown as IEventsApi;

  const sessionReview: ISessionReview = {
    comparePlannedVsActual: async ({ eventId }) => {
      calls.eventIds.push(eventId!);
      return h.reviews?.[eventId!] ?? review({ eventId: eventId! });
    },
  };

  const intensityDistribution = {
    compareIntensityDistribution: async () => {
      throw new Error("the digest reads the range form only");
    },
    compareIntensityDistributionRange: async ({
      oldest,
      newest,
    }: {
      oldest: string;
      newest: string;
    }) => {
      calls.ranges.push(`${oldest}..${newest}`);
      return {
        oldest,
        newest,
        sessions: [],
        excluded: [],
        ...h.range,
      } as IntensityDistributionRangeResult;
    },
  } as unknown as IIntensityDistribution;

  const service = createExecutionDigest({
    eventsApi,
    activitiesApi,
    sessionReview,
    intensityDistribution,
    getFtp: async () => {
      calls.athleteFtpReads++;
      return h.ftp === undefined ? FTP : h.ftp;
    },
  });

  return { service, calls };
}

const WINDOW = { oldest: "2026-09-01", newest: "2026-09-17" };

describe("getExecutionDigest — the window", () => {
  it("refuses a window longer than one block", async () => {
    const { service } = digest({ events: [] });
    await expect(
      service.getExecutionDigest({ oldest: "2026-08-01", newest: "2026-09-17" })
    ).rejects.toThrow(/over the 28-day maximum/);
  });

  it("refuses a window that ends before it starts", async () => {
    const { service } = digest({ events: [] });
    await expect(
      service.getExecutionDigest({ oldest: "2026-09-17", newest: "2026-09-01" })
    ).rejects.toThrow(/ends before it starts/);
  });
});

describe("getExecutionDigest — selecting key sessions", () => {
  it("skips a window holding no key session, and leaves the watermark alone", async () => {
    const { service, calls } = digest({
      events: [
        event(1, "Endurance", [step("Endurance", 200)]),
        event(2, "Recovery spin", [step("Recovery", 150)]),
      ],
    });

    const result = await service.getExecutionDigest(WINDOW);

    expect(result.status).toBe("skipped");
    expect(result.reviewedThrough).toBeUndefined();
    expect(result.nonKeySessions).toBe(2);
    expect(result.sessions).toEqual([]);
    // A skip costs nothing: neither lens is run.
    expect(calls.eventIds).toEqual([]);
    expect(calls.ranges).toEqual([]);
  });

  it("selects on a declared work step, not on any step reaching the floor", async () => {
    // The warm-up ramp tops out above the floor. It declares no role, so it
    // cannot pull an endurance ride into the review.
    const { service, calls } = digest({
      events: [
        event(1, "Endurance with a hard warm-up", [
          step("Ramp 6", FLOOR + 40, 60),
          step("Endurance", 200, 3600),
        ]),
        event(2, "Threshold 2×15", [step("Threshold", FLOOR + 10, 900)]),
      ],
    });

    const result = await service.getExecutionDigest(WINDOW);

    expect(result.status).toBe("reviewed");
    expect(result.reviewedThrough).toBe("2026-09-17");
    expect(calls.eventIds).toEqual([2]);
    expect(result.nonKeySessions).toBe(1);
  });

  it("leaves a work step below the floor out of the selection", async () => {
    const { service } = digest({
      events: [event(1, "Tempo", [step("Tempo", FLOOR - 20, 900)])],
    });
    expect((await service.getExecutionDigest(WINDOW)).status).toBe("skipped");
  });

  it("selects a key session that was never ridden, rather than missing it", async () => {
    const { service } = digest({
      events: [event(1, "Team track", [step("Sprint", 700, 20)])],
      reviews: {
        1: review({
          eventId: 1,
          alignmentBasis: "none",
          reason: "no-paired-activity",
          message: "Planned event 1 has no completed activity paired to it.",
        }),
      },
    });

    const [session] = (await service.getExecutionDigest(WINDOW)).sessions;
    expect(session!.reason).toBe("no-paired-activity");
    expect(session!.alignmentBasis).toBe("none");
    expect(session!.flagged).toEqual([]);
  });

  it("falls back to athlete FTP for an event carrying none", async () => {
    const bare = event(1, "Threshold", [step("Threshold", FLOOR + 10, 900)]);
    delete (bare as { icu_ftp?: number | null }).icu_ftp;

    const { service, calls } = digest({ events: [bare] });
    await service.getExecutionDigest(WINDOW);
    expect(calls.eventIds).toEqual([1]);
  });

  it("reads a plan at its paired ride's FTP, as the review does", async () => {
    // 274 W clears 88% of the athlete's 300 W but not of the 320 W the ride
    // was recorded at — the FTP the review will judge this plan against.
    const bare = event(1, "Threshold", [step("Threshold", FLOOR + 10, 900)]);
    delete (bare as { icu_ftp?: number | null }).icu_ftp;

    const { service, calls } = digest({
      events: [bare],
      rides: [{ id: "i1", paired_event_id: 1, icu_ftp: 320 }],
    });

    expect((await service.getExecutionDigest(WINDOW)).status).toBe("skipped");
    expect(calls.athleteFtpReads).toBe(0);
  });

  it("looks for paired rides as far past the window as the review does", async () => {
    const { service, calls } = digest({ events: [] });
    await service.getExecutionDigest(WINDOW);
    expect(calls.rideRanges).toEqual(["2026-08-30..2026-09-19"]);
  });

  it("skips rather than guesses when no FTP resolves at all", async () => {
    const bare = event(1, "Threshold", [step("Threshold", FLOOR + 10, 900)]);
    delete (bare as { icu_ftp?: number | null }).icu_ftp;

    const { service } = digest({ events: [bare], ftp: null });
    expect((await service.getExecutionDigest(WINDOW)).status).toBe("skipped");
  });
});

describe("getExecutionDigest — the mechanical filter", () => {
  const key = event(1, "Threshold 3×10", [
    step("Warm-up", 150, 600),
    step("Threshold", FLOOR + 10, 600, 90),
    step("Recovery", 150, 300),
    step("Threshold", FLOOR + 10, 600, 90),
    step("Recovery", 150, 300),
  ]);

  it("judges only the declared work steps, and counts the rest", async () => {
    const { service } = digest({
      events: [key],
      reviews: {
        1: review({
          eventId: 1,
          steps: [
            // Every support step reads `under` — a warm-up ridden easy and
            // recovery taken as easily as prescribed.
            aligned({ index: 0, verdict: "under", deltas: { watts: -20 } }),
            aligned({ index: 1, verdict: "under", deltas: { watts: -18 } }),
            aligned({ index: 2, verdict: "under", deltas: { watts: -30 } }),
            aligned({ index: 3 }),
            aligned({ index: 4, verdict: "under", deltas: { watts: -25 } }),
          ],
        }),
      },
    });

    const [session] = (await service.getExecutionDigest(WINDOW)).sessions;
    expect(session!.workSteps).toBe(2);
    expect(session!.unclassifiedSteps).toBe(3);
    expect(session!.flagged.map((f) => f.index)).toEqual([1]);
  });

  it("drops a band step outside its own band by less than noise", async () => {
    const { service } = digest({
      events: [key],
      reviews: {
        1: review({
          eventId: 1,
          steps: [
            aligned({
              index: 1,
              planned: { target: { low: 260, high: 280 } },
              verdict: "under",
              deltas: { watts: -4, wattsFraction: -0.015 },
            }),
            aligned({
              index: 3,
              planned: { target: { low: 260, high: 280 } },
              verdict: "under",
              deltas: { watts: -18, wattsFraction: -0.07 },
            }),
          ],
        }),
      },
    });

    const [session] = (await service.getExecutionDigest(WINDOW)).sessions;
    expect(session!.flagged.map((f) => f.index)).toEqual([3]);
  });

  it("keeps a point-target miss whatever its size — tolerance already judged it", async () => {
    const { service } = digest({
      events: [key],
      reviews: {
        1: review({
          eventId: 1,
          steps: [
            aligned({
              index: 1,
              planned: { target: { watts: 270 } },
              verdict: "under",
              deltas: { watts: -15, wattsFraction: -0.055 },
            }),
          ],
        }),
      },
    });

    const [session] = (await service.getExecutionDigest(WINDOW)).sessions;
    expect(session!.flagged).toHaveLength(1);
  });

  it("flags a rep that met its power and missed its cadence", async () => {
    const { service } = digest({
      events: [key],
      reviews: {
        1: review({
          eventId: 1,
          steps: [
            aligned({
              index: 1,
              verdict: "on-target",
              cadenceVerdict: "under",
              deltas: { watts: 0, cadence: -15 },
            }),
            aligned({
              index: 3,
              verdict: "on-target",
              cadenceVerdict: "on-target",
            }),
          ],
        }),
      },
    });

    const [session] = (await service.getExecutionDigest(WINDOW)).sessions;
    expect(session!.flagged.map((f) => f.index)).toEqual([1]);
    expect(session!.cadence).toEqual({ judged: 2, missed: 1 });
  });

  it("rolls cadence up across the work steps, so a session-wide miss reads as one", async () => {
    const { service } = digest({
      events: [key],
      reviews: {
        1: review({
          eventId: 1,
          steps: [
            aligned({ index: 0, cadenceVerdict: "under" }),
            aligned({ index: 1, cadenceVerdict: "under" }),
            aligned({ index: 3, cadenceVerdict: "under" }),
          ],
        }),
      },
    });

    const [session] = (await service.getExecutionDigest(WINDOW)).sessions;
    // Step 0 is the warm-up: its cadence verdict is not part of the roll-up.
    expect(session!.cadence).toEqual({ judged: 2, missed: 2 });
  });

  it("keeps an unmatched or not-attempted work step", async () => {
    const { service } = digest({
      events: [key],
      reviews: {
        1: review({
          eventId: 1,
          steps: [
            aligned({ index: 1, verdict: "unmatched" }),
            aligned({ index: 3, verdict: "not-attempted" }),
          ],
        }),
      },
    });

    const [session] = (await service.getExecutionDigest(WINDOW)).sessions;
    expect(session!.flagged.map((f) => f.verdict)).toEqual([
      "unmatched",
      "not-attempted",
    ]);
  });

  it("carries a coasting fraction only where it qualifies the reading", async () => {
    const { service } = digest({
      events: [key],
      reviews: {
        1: review({
          eventId: 1,
          steps: [
            aligned({
              index: 1,
              verdict: "under",
              verdictBasis: "normalized-power",
              planned: { target: { watts: 270 } },
              delivered: {
                intervalIndex: 1,
                durationSeconds: 600,
                coastingFraction: 0.12,
              },
            }),
            aligned({
              index: 3,
              verdict: "under",
              planned: { target: { watts: 270 } },
              delivered: {
                intervalIndex: 3,
                durationSeconds: 600,
                coastingFraction: 0.01,
              },
            }),
          ],
        }),
      },
    });

    const [first, second] = (await service.getExecutionDigest(WINDOW))
      .sessions[0]!.flagged;
    expect(first!.coastingFraction).toBe(0.12);
    expect(second!.coastingFraction).toBeUndefined();
  });

  it("carries no step label — a label here runs to a paragraph of prose", async () => {
    const { service } = digest({
      events: [key],
      reviews: {
        1: review({
          eventId: 1,
          steps: [
            aligned({
              index: 1,
              label:
                "Threshold. Sit at the top of sweet spot and hold it even.",
              verdict: "under",
              planned: { target: { watts: 270 } },
            }),
          ],
        }),
      },
    });

    const [flagged] = (await service.getExecutionDigest(WINDOW)).sessions[0]!
      .flagged;
    expect(flagged).not.toHaveProperty("label");
  });
});

describe("getExecutionDigest — the dose", () => {
  const key = event(1, "Threshold", [step("Threshold", FLOOR + 10, 900)]);

  it("joins each session to its own middle-band figures", async () => {
    const { service } = digest({
      events: [key],
      range: {
        middleBand: {
          lowW: 228,
          highW: 318,
          lowPctFtp: 76,
          highPctFtp: 106,
          plannedSeconds: 1800,
          deliveredSeconds: 1700,
          deltaSeconds: -100,
          deliveredFraction: 0.944,
        },
        sessions: [
          {
            eventId: 1,
            middleBandPlannedSeconds: 900,
            middleBandDeliveredSeconds: 850,
            middleBandDeliveredFraction: 0.944,
          },
          {
            eventId: 99,
            middleBandPlannedSeconds: 900,
            middleBandDeliveredSeconds: 850,
          },
        ],
      },
    });

    const result = await service.getExecutionDigest(WINDOW);
    expect(result.middleBand?.deliveredFraction).toBeCloseTo(0.944);
    expect(result.sessions[0]!.middleBandDeliveredSeconds).toBe(850);
  });

  it("keeps the excluded sessions but drops their prose", async () => {
    const { service } = digest({
      events: [key],
      range: {
        excluded: [
          {
            date: "2026-09-12",
            eventId: 7,
            name: "Strength — Maintain",
            reason: "no-structured-steps",
            message:
              "Planned event 7 carries no structured workout steps, so there " +
              "is no prescribed distribution to compare the ride against.",
          },
        ],
      },
    });

    const [excluded] = (await service.getExecutionDigest(WINDOW)).excluded;
    expect(excluded).toEqual({
      date: "2026-09-12",
      eventId: 7,
      name: "Strength — Maintain",
      reason: "no-structured-steps",
    });
  });
});
