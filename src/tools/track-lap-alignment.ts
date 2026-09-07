import { z } from "zod";
import type { IIntervalsClient } from "../index.js";
import { resolveTrackInputs, trackInputFields } from "./track-inputs.js";

export const computeTrackLapPowerSchema = z.object({ ...trackInputFields });

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
  return client.computeTrackLapPower(resolveTrackInputs(client, args));
}
