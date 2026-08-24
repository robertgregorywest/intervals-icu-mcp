import { z } from "zod";
import type { IIntervalsClient } from "../index.js";
import { dateString } from "./common.js";

export const getTrainingWeekSummarySchema = z.object({
  weekStart: dateString
    .optional()
    .describe(
      "Start of the week (Monday) in YYYY-MM-DD. Defaults to the current week's Monday."
    ),
});

const fitnessDeltaShape = z
  .object({
    startDate: z.string(),
    endDate: z.string(),
    ctl: z.object({
      start: z.number(),
      end: z.number(),
      delta: z.number(),
    }),
    atl: z.object({
      start: z.number(),
      end: z.number(),
      delta: z.number(),
    }),
    tsb: z.object({
      start: z.number(),
      end: z.number(),
    }),
  })
  .nullable();

export const getTrainingWeekSummaryOutputSchema = z.object({
  week: z.object({ start: z.string(), end: z.string() }),
  totals: z.object({
    activityCount: z.number(),
    tss: z.number(),
    durationSeconds: z.number(),
    durationHours: z.number(),
  }),
  bySport: z.record(
    z.object({
      count: z.number(),
      tss: z.number(),
      hours: z.number(),
    })
  ),
  fitness: fitnessDeltaShape,
  completedActivities: z.array(
    z.object({
      id: z.union([z.number(), z.string()]).nullable().optional(),
      date: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      tss: z.number(),
      durationMin: z.number(),
      distanceKm: z.number().nullable(),
      avgWatts: z.number().nullable(),
      avgHr: z.number().nullable(),
    })
  ),
  events: z.array(
    z.object({
      id: z.union([z.number(), z.string()]).nullable().optional(),
      date: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
    })
  ),
});

export async function getTrainingWeekSummary(
  client: IIntervalsClient,
  args: z.infer<typeof getTrainingWeekSummarySchema>
): Promise<z.infer<typeof getTrainingWeekSummaryOutputSchema>> {
  return client.getTrainingWeekSummary(args.weekStart);
}
