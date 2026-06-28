import { z } from "zod";
import type { IIntervalsClient } from "../index.js";
import type { WorkoutPlan } from "../services/workout-builder/index.js";
import { slugify } from "../services/workout-builder/index.js";
import { dateString } from "./common.js";

const sportTypeEnum = z.enum([
  "Ride",
  "Run",
  "Swim",
  "VirtualRide",
  "MountainBikeRide",
  "GravelRide",
  "TrailRun",
  "WeightTraining",
  "Yoga",
  "Hike",
  "OpenWaterSwim",
]);

export const workoutStepSchema = z.object({
  label: z.string().optional().describe("Optional label/cue for this step"),
  duration: z
    .string()
    .describe(
      'Step duration or distance, e.g. "5m", "30s", "1h2m30s", "2km", "500mtr"'
    ),
  target: z
    .string()
    .optional()
    .describe(
      "Intensity target — prefer absolute watts when user gives specific power numbers. " +
        'A range like "160w-256w" is a steady target BAND (ride held within the range), NOT a ramp. ' +
        'Examples: "200w" (watts), "160w-256w" (watt band), "75%" (FTP%), "Z2" (zone), "70% HR", "5:00/km Pace"'
    ),
  cadence: z.string().optional().describe('Cadence target, e.g. "90rpm"'),
  ramp: z
    .boolean()
    .optional()
    .describe(
      "Set true ONLY for a genuine linear ramp where the target rises across the step (ramp test, warm-up build). " +
        'A steady endurance/sweet-spot/recovery band must NOT set ramp — a plain range like "160w-256w" is already a held band; ' +
        "setting ramp forces a linear sweep across the whole step. A long/wide ramp also collapses to one average wattage on " +
        "head units, so split real ramps into steps of ≤ 2 min and ≤ ~25–30 W each."
    ),
});

export const repeatBlockSchema = z.object({
  iterations: z.number().describe("Number of times to repeat the steps"),
  label: z
    .string()
    .optional()
    .describe('Optional label for the repeat block, e.g. "Main Set"'),
  steps: z.array(workoutStepSchema).describe("Steps to repeat"),
});

export const createWorkoutSchema = z.object({
  name: z.string().describe("Workout name"),
  date: dateString.describe("Date in YYYY-MM-DD format"),
  sportType: sportTypeEnum.describe(
    "Sport type — Ride/Run/Swim/VirtualRide/MountainBikeRide/GravelRide/TrailRun/WeightTraining/Yoga/Hike/OpenWaterSwim"
  ),
  steps: z
    .array(z.union([workoutStepSchema, repeatBlockSchema]))
    .min(1)
    .describe(
      "Workout steps — simple steps and/or repeat blocks. " +
        'Example: [{ label: "Warmup", duration: "10m", target: "160w-200w" }, ' +
        '{ iterations: 4, steps: [{ duration: "5m", target: "240w" }, { duration: "3m", target: "150w" }] }]'
    ),
  externalId: z
    .string()
    .optional()
    .describe("Optional external ID for upsert matching"),
  color: z.string().optional().describe("Optional event color"),
});

export const createWorkoutOutputSchema = z.object({
  success: z.literal(true),
  created: z.number(),
  events: z.array(
    z.object({
      id: z.number().optional(),
      name: z.string(),
      start_date_local: z.string(),
      description: z.string(),
    })
  ),
});

export async function createWorkout(
  client: IIntervalsClient,
  args: z.infer<typeof createWorkoutSchema>
): Promise<z.infer<typeof createWorkoutOutputSchema>> {
  const plan: WorkoutPlan = {
    name: args.name,
    date: args.date,
    sportType: args.sportType,
    steps: args.steps,
    externalId: args.externalId,
    color: args.color,
  };

  const event = client.buildWorkoutEvent(plan);
  const result = await client.createEvents([event]);

  return formatResponse(result);
}

export const createStrengthWorkoutSchema = z.object({
  name: z.string().describe("Strength session name"),
  date: dateString.describe("Date in YYYY-MM-DD format"),
  description: z
    .string()
    .describe(
      "Free-form description of the strength session. " +
        "Include exercises, sets, reps, load, and RPE. " +
        'Example: "Box Squat 3×5 @ RPE 7\\nTrap Bar Deadlift 3×5 @ RPE 8\\nBulgarian Split Squat 3×8 each leg\\nPull-ups 3×8"'
    ),
  externalId: z
    .string()
    .optional()
    .describe("Optional external ID for upsert matching"),
  color: z.string().optional().describe("Optional event color"),
});

export async function createStrengthWorkout(
  client: IIntervalsClient,
  args: z.infer<typeof createStrengthWorkoutSchema>
): Promise<z.infer<typeof createWorkoutOutputSchema>> {
  const externalId =
    args.externalId || `mcp-${args.date}-${slugify(args.name)}`;

  const event = {
    category: "WORKOUT" as const,
    start_date_local: `${args.date}T00:00:00`,
    type: "WeightTraining" as const,
    name: args.name,
    description: args.description,
    external_id: externalId,
    ...(args.color ? { color: args.color } : {}),
  };

  const result = await client.createEvents([event]);

  return formatResponse(result);
}

function formatResponse(
  events: Array<{
    id?: number;
    name: string;
    start_date_local: string;
    description: string;
  }>
): z.infer<typeof createWorkoutOutputSchema> {
  return {
    success: true,
    created: events.length,
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      start_date_local: e.start_date_local,
      description: e.description,
    })),
  };
}
