import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";

export const getAerobicDecouplingSchema = z.object({
  activityId: z
    .union([z.string(), z.number()])
    .describe(
      'Activity ID (e.g. "i151827252" from get_activities, or bare number)'
    ),
});

const decouplingHalfShape = z.object({
  avgPower: z.number(),
  avgHR: z.number(),
  hrPowerRatio: z.number(),
});

export const getAerobicDecouplingOutputSchema = z.object({
  firstHalf: decouplingHalfShape,
  secondHalf: decouplingHalfShape,
  decouplingPercent: z.number(),
  interpretation: z.string(),
});

export async function getAerobicDecoupling(
  client: IIntervalsClient,
  args: z.infer<typeof getAerobicDecouplingSchema>
): Promise<z.infer<typeof getAerobicDecouplingOutputSchema>> {
  return client.getAerobicDecoupling(normalizeActivityId(args.activityId));
}

export const compareIntervalsSchema = z.object({
  activityIds: z
    .array(z.union([z.string(), z.number()]))
    .describe(
      "Activity IDs to compare intervals across " +
        '(e.g. ["i151827252", "i151543822"] from get_activities)'
    ),
  minPower: z
    .number()
    .optional()
    .describe("Minimum average power (watts) to include an interval"),
  targetDuration: z
    .number()
    .optional()
    .describe(
      "Target interval duration in seconds — filters to matching intervals"
    ),
  durationTolerance: z
    .number()
    .optional()
    .describe(
      "Tolerance for duration filter as a fraction (default: 0.2 = ±20%)"
    ),
});

const intervalValueShape = z.object({
  activityId: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  date: z.string().optional(),
  avg_watts: z.number().optional(),
  max_watts: z.number().optional(),
  avg_hr: z.number().optional(),
  avg_cadence: z.number().optional(),
  elapsed: z.number().optional(),
});

const intervalSummaryShape = z.object({
  activityId: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  date: z.string().optional(),
  intervalCount: z.number(),
  avgPower: z.number().nullable(),
  minPower: z.number().nullable(),
  maxPower: z.number().nullable(),
  powerRange: z.number().nullable(),
  avgCadence: z.number().nullable(),
  totalDuration: z.number(),
});

export const compareIntervalsOutputSchema = z.object({
  intervals: z.array(
    z.object({
      lapNumber: z.number(),
      values: z.array(intervalValueShape),
    })
  ),
  summaries: z.array(intervalSummaryShape),
});

export async function compareIntervalsHandler(
  client: IIntervalsClient,
  args: z.infer<typeof compareIntervalsSchema>
): Promise<z.infer<typeof compareIntervalsOutputSchema>> {
  return client.compareIntervals(args.activityIds.map(normalizeActivityId), {
    minPower: args.minPower,
    targetDuration: args.targetDuration,
    durationTolerance: args.durationTolerance,
  });
}

function normalizeActivityId(id: string | number): string {
  if (typeof id === "number") return `i${id}`;
  return id.startsWith("i") ? id : `i${id}`;
}
