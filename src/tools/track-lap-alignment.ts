import { z } from "zod";
import type { IIntervalsClient } from "../index.js";

export const computeTrackLapPowerSchema = z.object({
  activityId: z
    .union([z.string(), z.number()])
    .describe(
      'Completed track activity ID (e.g. "i173732945" from get_activities, or a ' +
        "bare number). Must be the ride the lap splits were timed on."
    ),
  splits: z
    .string()
    .describe(
      "The lap-timer export, pasted as exported. One row per lap: run identifier, " +
        "cumulative distance (m), cumulative time (s), lap time (s). A header row " +
        "and extra trailing columns are fine. Rows are grouped into runs by the " +
        "first column, in the order they appear."
    ),
  lapDistanceMeters: z
    .number()
    .positive()
    .optional()
    .describe("Lap length in metres. Defaults to 250."),
});

const reading = z.object({
  watts: z.number().optional(),
  wattsBand: z.number().optional(),
  cadence: z.number().optional(),
  cadenceBand: z.number().optional(),
  heartrate: z.number().optional(),
  heartrateBand: z.number().optional(),
});

const confidence = z.object({
  residualRpm: z.number(),
  offsetIntervalSeconds: z.tuple([z.number(), z.number()]),
  nextBestOffsetSeconds: z.number().optional(),
  nextBestResidualRpm: z.number().optional(),
  residualRatio: z.number().optional(),
  verdict: z.enum(["strong", "marginal", "weak", "ambiguous"]),
  reason: z.string().optional(),
  lapsFitted: z.number(),
  lapsExcluded: z.number(),
});

export const computeTrackLapPowerOutputSchema = z.object({
  activityId: z.string(),
  lapDistanceMeters: z.number(),
  samplingIntervalSeconds: z.number(),
  runs: z.array(
    z.object({
      run: z.string(),
      startOffsetSeconds: z.number(),
      durationSeconds: z.number(),
      distanceMeters: z.number(),
      fittedRolloutMeters: z.number(),
      confidence,
      average: reading,
      laps: z
        .array(
          z.object({
            index: z.number(),
            lapTimeSeconds: z.number(),
            startSeconds: z.number(),
            endSeconds: z.number(),
            reading,
          })
        )
        .optional(),
      lapsWithheld: z.string().optional(),
    })
  ),
  rolloutAgreement: z
    .object({
      minMeters: z.number(),
      maxMeters: z.number(),
      spreadPercent: z.number(),
    })
    .optional(),
  thresholds: z.object({
    strongResidualRpm: z.number(),
    marginalResidualRpm: z.number(),
    ambiguousResidualRatio: z.number(),
    minSamplesPerLap: z.number(),
  }),
  notes: z.array(z.string()).optional(),
});

export async function computeTrackLapPower(
  client: IIntervalsClient,
  args: z.infer<typeof computeTrackLapPowerSchema>
): Promise<z.infer<typeof computeTrackLapPowerOutputSchema>> {
  return client.computeTrackLapPower({
    activityId: normalizeActivityId(args.activityId),
    splits: args.splits,
    lapDistanceMeters: args.lapDistanceMeters,
  });
}

function normalizeActivityId(id: string | number): string {
  if (typeof id === "number") return `i${id}`;
  return id.startsWith("i") ? id : `i${id}`;
}
