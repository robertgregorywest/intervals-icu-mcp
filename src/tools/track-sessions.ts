import { z } from "zod";
import type { IIntervalsClient } from "../index.js";

export const listTrackSessionsSchema = z.object({});

export const getTrackSessionSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe(
      'Session id — the record filename without `.md`, e.g. "2026-nationals-ip". ' +
        "Use list_track_sessions to see what is on file."
    ),
  segmentLaps: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Laps per segment for the opening/closing decomposition. Defaults to the " +
        "widest pair that leaves a lap between them, capped at 3 — which is laps " +
        "2-4 and 6-8 for a 2 km pursuit."
    ),
});

export const compareTrackSessionsSchema = z.object({
  runs: z
    .array(z.string().min(1))
    .min(2)
    .describe(
      'Runs to compare, as "<sessionId>" or "<sessionId>#<run>". A bare id works ' +
        "for a single-run session. THE FIRST IS THE BASELINE — every delta is " +
        "taken against it."
    ),
  segmentLaps: z.number().int().positive().optional(),
});

const runStart = z.enum(["gate", "standing", "flying"]);

const basis = z.object({
  id: z.string(),
  date: z.string(),
  kind: z.enum(["race", "training"]),
  event: z.string().optional(),
  venue: z.string().optional(),
  gear: z.string().optional(),
  rolloutMm: z.number(),
  developmentMeters: z.number().optional(),
  crankLengthMm: z.number().optional(),
  suit: z.string().optional(),
  lapDistanceMeters: z.number(),
  activityId: z.string().optional(),
  source: z.string().optional(),
  start: runStart,
  runStarts: z.record(z.string(), runStart),
});

const segment = z.object({
  fromLap: z.number(),
  toLap: z.number(),
  timeSeconds: z.number(),
  meanSpeedMetersPerSecond: z.number(),
});

export const listTrackSessionsOutputSchema = z.object({
  directory: z.string(),
  sessions: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      kind: z.enum(["race", "training"]),
      event: z.string().optional(),
      venue: z.string().optional(),
      activityId: z.string().optional(),
      runs: z.array(
        z.object({
          ref: z.string(),
          run: z.string(),
          start: runStart,
          laps: z.number(),
          distanceMeters: z.number(),
          durationSeconds: z.number(),
        })
      ),
    })
  ),
  notes: z.array(z.string()).optional(),
});

export const getTrackSessionOutputSchema = z.object({
  basis,
  developmentMeters: z.number().optional(),
  developmentSource: z.enum(["gear", "supplied"]).optional(),
  prose: z.string(),
  runs: z.array(
    z.object({
      ref: z.string(),
      run: z.string(),
      start: runStart,
      laps: z.array(
        z.object({
          lap: z.number(),
          lapTimeSeconds: z.number(),
          cumulativeTimeSeconds: z.number(),
          speedMetersPerSecond: z.number(),
          cadenceRpm: z.number().optional(),
          standingStart: z.boolean(),
        })
      ),
      summary: z.object({
        totalTimeSeconds: z.number(),
        totalDistanceMeters: z.number(),
        flyingLaps: z.number(),
        flyingTimeSeconds: z.number(),
        flyingDistanceMeters: z.number(),
        meanLapTimeSeconds: z.number(),
        meanSpeedMetersPerSecond: z.number(),
        lapTimeSdSeconds: z.number(),
        opening: segment.optional(),
        closing: segment.optional(),
        declineRatio: z.number().optional(),
        segmentsWithheld: z.string().optional(),
        pacing: z.object({
          sumSquaredSpeed: z.number(),
          rmsSpeedMetersPerSecond: z.number(),
          flatEquivalentTimeSeconds: z.number(),
          gainSeconds: z.number(),
        }),
      }),
    })
  ),
  notes: z.array(z.string()).optional(),
});

export const compareTrackSessionsOutputSchema = z.object({
  refs: z.array(z.string()),
  columns: z.array(
    z.object({
      ref: z.string(),
      date: z.string(),
      event: z.string().optional(),
      gear: z.string().optional(),
      start: runStart,
    })
  ),
  laps: z.array(
    z.object({
      lap: z.number(),
      standingStart: z.boolean(),
      values: z.array(z.number().optional()),
      deltas: z.array(z.number().optional()),
    })
  ),
  summary: z.array(
    z.object({
      label: z.string(),
      values: z.array(z.number().optional()),
      deltas: z.array(z.number().optional()),
      unit: z.enum(["seconds", "ratio"]),
    })
  ),
  notes: z.array(z.string()).optional(),
});

export async function listTrackSessions(
  client: IIntervalsClient
): Promise<z.infer<typeof listTrackSessionsOutputSchema>> {
  return client.listTrackSessions();
}

export async function getTrackSession(
  client: IIntervalsClient,
  args: z.infer<typeof getTrackSessionSchema>
): Promise<z.infer<typeof getTrackSessionOutputSchema>> {
  return client.getTrackSession(args);
}

export async function compareTrackSessions(
  client: IIntervalsClient,
  args: z.infer<typeof compareTrackSessionsSchema>
): Promise<z.infer<typeof compareTrackSessionsOutputSchema>> {
  return client.compareTrackSessions(args);
}
