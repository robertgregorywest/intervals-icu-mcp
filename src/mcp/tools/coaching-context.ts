import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";
import {
  DEFAULT_DAYS,
  MAX_DAYS,
} from "../../services/coaching-context/index.js";

export const getCoachingContextSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(MAX_DAYS)
    .optional()
    .describe(
      `Days of wellness history to include (default ${DEFAULT_DAYS}, max ${MAX_DAYS}).`
    ),
});

const zoneSchema = z.object({
  id: z.number(),
  name: z.string(),
  min: z.number(),
  max: z.number(),
});

export const getCoachingContextOutputSchema = z.object({
  asOf: z.string(),
  daysWindow: z.number(),
  athlete: z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    weight: z.number().nullable(),
    ftp: z.number().nullable(),
    lthr: z.number().nullable(),
    max_hr: z.number().nullable(),
    resting_hr: z.number().nullable(),
    power_zones: z.array(zoneSchema).nullable(),
    hr_zones: z.array(zoneSchema).nullable(),
    pace_zones: z.array(zoneSchema).nullable(),
    sport_settings_count: z.number(),
  }),
  fitness: z.object({
    date: z.string().nullable(),
    ctl: z.number().nullable(),
    atl: z.number().nullable(),
    tsb: z.number().nullable(),
    ramp_rate: z.number().nullable(),
  }),
  wellnessTrend: z.array(
    z.object({
      date: z.string(),
      ctl: z.number(),
      atl: z.number(),
      tsb: z.number(),
      fatigue: z.number().nullable(),
      soreness: z.number().nullable(),
      motivation: z.number().nullable(),
      mood: z.number().nullable(),
      stress: z.number().nullable(),
      readiness: z.number().nullable(),
      sleep_secs: z.number().nullable(),
      sleep_score: z.number().nullable(),
      resting_hr: z.number().nullable(),
      hrv: z.number().nullable(),
    })
  ),
  map: z
    .object({
      watts: z.number(),
      computedFrom: z.object({
        metric: z.literal("best_60s"),
        activityId: z.union([z.number(), z.string()]),
        activityName: z.string(),
        activityDate: z.string(),
        daysAgo: z.number(),
      }),
    })
    .nullable(),
  mapWarning: z.string().optional(),
});

export async function getCoachingContext(
  client: IIntervalsClient,
  args: z.infer<typeof getCoachingContextSchema>
): Promise<z.infer<typeof getCoachingContextOutputSchema>> {
  return client.getCoachingContext({ days: args.days });
}
