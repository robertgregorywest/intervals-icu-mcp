import { z } from "zod";
import type { IIntervalsClient } from "../index.js";
import type { Activity } from "../services/activities/index.js";
import type { WellnessRecord } from "../services/wellness/index.js";
import type { IntervalsEvent } from "../types.js";
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
    start_date: z.string(),
    end_date: z.string(),
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
    activity_count: z.number(),
    tss: z.number(),
    duration_seconds: z.number(),
    duration_hours: z.number(),
  }),
  by_sport: z.record(
    z.object({
      count: z.number(),
      tss: z.number(),
      hours: z.number(),
    })
  ),
  fitness: fitnessDeltaShape,
  completed_activities: z.array(
    z
      .object({
        id: z.union([z.number(), z.string()]).nullable().optional(),
        date: z.string().nullable().optional(),
        type: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        source: z.string().nullable().optional(),
        tss: z.number(),
        duration_min: z.number(),
        distance_km: z.number().nullable(),
        avg_watts: z.number().nullable(),
        avg_hr: z.number().nullable(),
      })
      .passthrough()
  ),
  events: z.array(
    z
      .object({
        id: z.union([z.number(), z.string()]).nullable().optional(),
        date: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        type: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
      })
      .passthrough()
  ),
});

export async function getTrainingWeekSummary(
  client: IIntervalsClient,
  args: z.infer<typeof getTrainingWeekSummarySchema>
): Promise<z.infer<typeof getTrainingWeekSummaryOutputSchema>> {
  const weekStart = args.weekStart ?? currentMonday();
  const weekEnd = addDays(weekStart, 6);

  const [activities, wellness, events] = await Promise.all([
    client.getActivities(weekStart, weekEnd),
    client.getWellness(weekStart, weekEnd),
    client.getEvents(weekStart, weekEnd),
  ]);

  return {
    week: { start: weekStart, end: weekEnd },
    totals: computeTotals(activities),
    by_sport: groupBySport(activities),
    fitness: computeFitnessDelta(wellness),
    completed_activities: activities.map(summarizeActivity),
    events: events.map(summarizeEvent),
  };
}

function computeTotals(activities: Activity[]) {
  let tss = 0;
  let seconds = 0;
  for (const a of activities) {
    tss += numericField(a, "icu_training_load");
    seconds += numericField(a, "moving_time");
  }
  return {
    activity_count: activities.length,
    tss: round1(tss),
    duration_seconds: seconds,
    duration_hours: round1(seconds / 3600),
  };
}

function groupBySport(
  activities: Activity[]
): Record<string, { count: number; tss: number; hours: number }> {
  const out: Record<string, { count: number; tss: number; hours: number }> = {};
  for (const a of activities) {
    const sport = String(a.type || "Unknown");
    const slot = out[sport] ?? { count: 0, tss: 0, hours: 0 };
    slot.count += 1;
    slot.tss = round1(slot.tss + numericField(a, "icu_training_load"));
    slot.hours = round1(slot.hours + numericField(a, "moving_time") / 3600);
    out[sport] = slot;
  }
  return out;
}

function computeFitnessDelta(wellness: WellnessRecord[]) {
  if (!wellness.length) return null;
  const sorted = [...wellness].sort((a, b) =>
    String(a.id).localeCompare(String(b.id))
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    start_date: String(first.id),
    end_date: String(last.id),
    ctl: {
      start: round1(first.ctl),
      end: round1(last.ctl),
      delta: round1(last.ctl - first.ctl),
    },
    atl: {
      start: round1(first.atl),
      end: round1(last.atl),
      delta: round1(last.atl - first.atl),
    },
    tsb: {
      start: round1(first.ctl - first.atl),
      end: round1(last.ctl - last.atl),
    },
  };
}

function summarizeActivity(a: Activity) {
  const seconds = numericField(a, "moving_time");
  const meters = numericField(a, "distance");
  const source = typeof a.source === "string" ? a.source : null;
  return {
    id: a.id,
    date: a.start_date_local,
    type: a.type,
    name: a.name,
    source,
    tss: round1(numericField(a, "icu_training_load")),
    duration_min: Math.round(seconds / 60),
    distance_km: meters ? round1(meters / 1000) : null,
    avg_watts: numericField(a, "icu_average_watts") || null,
    avg_hr: numericField(a, "average_heartrate") || null,
  };
}

function summarizeEvent(e: IntervalsEvent) {
  return {
    id: e.id,
    date: e.start_date_local,
    category: e.category,
    type: e.type,
    name: e.name,
  };
}

function numericField(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  return typeof v === "number" ? v : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function currentMonday(): string {
  const today = new Date();
  const dow = today.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  today.setDate(today.getDate() + offset);
  return today.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
