import { z } from "zod";
import type { IIntervalsClient } from "../index.js";
import { withCharacterLimit } from "./common.js";

export const getPowerCurveSchema = z.object({
  type: z
    .string()
    .optional()
    .describe('Sport type filter, e.g. "Ride", "Run". Defaults to all types.'),
  range: z
    .string()
    .optional()
    .describe(
      'Time range for the curve: "90d" (90 days), "1y" (1 year), "all" (all time), ' +
        'or custom "r.YYYY-MM-DD.YYYY-MM-DD". ' +
        'Example: "r.2026-01-01.2026-03-31" for Q1 2026. ' +
        "Defaults to API default."
    ),
  secs: z
    .array(z.number().int().positive())
    .max(50)
    .optional()
    .describe(
      "Durations in seconds to return, e.g. [60, 120, 180, 300, 1200]. Each is " +
        "matched to the nearest point on the curve; requested_secs shows what was asked. " +
        "Omit for the whole curve."
    ),
  full: z
    .boolean()
    .optional()
    .describe(
      "Return the raw curve including values, watts_per_kg, wkg_activity_id, ranks and mapPlot " +
        "(~24 kB for 1y; may be truncated). Default false."
    ),
});

type Args = z.infer<typeof getPowerCurveSchema>;

const CURVE_ARRAYS = [
  "secs",
  "watts",
  "activity_id",
  "values",
  "watts_per_kg",
  "wkg_activity_id",
] as const;
const DROPPED_IN_THIN = new Set<string>([
  "values",
  "watts_per_kg",
  "wkg_activity_id",
  "ranks",
  "mapPlot",
]);

function nearestIndex(secs: number[], target: number): number {
  let best = 0;
  for (let i = 1; i < secs.length; i++) {
    if (Math.abs(secs[i] - target) < Math.abs(secs[best] - target)) best = i;
  }
  return best;
}

function thinCurve(
  curve: Record<string, unknown>,
  requested?: number[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(curve)) {
    if (!DROPPED_IN_THIN.has(k)) out[k] = v;
  }
  const secs = curve.secs;
  if (!requested || !Array.isArray(secs) || secs.length === 0) return out;

  const idx = requested.map((t) => nearestIndex(secs as number[], t));
  for (const key of CURVE_ARRAYS) {
    const arr = out[key];
    if (Array.isArray(arr)) out[key] = idx.map((i) => arr[i]);
  }
  out.requested_secs = requested;
  return out;
}

function thinPayload(raw: unknown, requested?: number[]): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const env = raw as Record<string, unknown>;
  const list = env.list;
  if (!Array.isArray(list)) return raw;

  const curves = list.map((c) =>
    thinCurve(c as Record<string, unknown>, requested)
  );
  const out: Record<string, unknown> = { ...env, list: curves };

  const activities = env.activities;
  if (activities && typeof activities === "object") {
    const used = new Set<string>();
    for (const c of curves) {
      if (Array.isArray(c.activity_id)) {
        for (const id of c.activity_id) used.add(String(id));
      }
    }
    out.activities = Object.fromEntries(
      Object.entries(activities).filter(([id]) => used.has(id))
    );
  }
  return out;
}

export async function getPowerCurve(
  client: IIntervalsClient,
  args: Args
): Promise<unknown> {
  const { secs, full, ...options } = args;
  const raw = await client.getPowerCurve(options);
  const payload = full ? raw : thinPayload(raw, secs);
  return withCharacterLimit(
    { points: payload },
    full
      ? "Power curve payload exceeds character limit. Drop full, or pass secs (e.g. [60, 300, 1200]) for the durations you need."
      : "Power curve payload exceeds character limit. Pass secs (e.g. [60, 300, 1200]) for the durations you need."
  );
}
