import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";
import type { WorkoutPlan } from "../../services/workout-builder/index.js";
import type { SportType } from "../../types.js";

const workoutStepSchema = z.object({
  label: z.string().optional().describe("Optional label/cue for this step"),
  duration: z
    .string()
    .describe(
      'Step duration or distance, e.g. "5m", "30s", "1h2m30s", "2km", "500mtr"',
    ),
  target: z
    .string()
    .optional()
    .describe(
      'Intensity target, e.g. "75%", "200w", "Z2", "70% HR", "5:00/km Pace", "50%-75%"',
    ),
  cadence: z.string().optional().describe('Cadence target, e.g. "90rpm"'),
  ramp: z
    .boolean()
    .optional()
    .describe("If true, target is a ramp (use range target like 50%-75%)"),
});

const repeatBlockSchema = z.object({
  iterations: z.number().describe("Number of times to repeat the steps"),
  label: z
    .string()
    .optional()
    .describe('Optional label for the repeat block, e.g. "Main Set"'),
  steps: z.array(workoutStepSchema).describe("Steps to repeat"),
});

export const createWorkoutSchema = z.object({
  name: z.string().describe("Workout name"),
  date: z.string().describe("Date in YYYY-MM-DD format"),
  sportType: z
    .string()
    .describe(
      "Sport type: Ride, Run, Swim, VirtualRide, MountainBikeRide, GravelRide, TrailRun, WeightTraining, Yoga, Hike",
    ),
  steps: z
    .array(z.union([workoutStepSchema, repeatBlockSchema]))
    .describe("Workout steps — simple steps and/or repeat blocks"),
  externalId: z
    .string()
    .optional()
    .describe("Optional external ID for upsert matching"),
  color: z.string().optional().describe("Optional event color"),
});

export async function createWorkout(
  client: IIntervalsClient,
  args: z.infer<typeof createWorkoutSchema>,
): Promise<string> {
  const plan: WorkoutPlan = {
    name: args.name,
    date: args.date,
    sportType: args.sportType as SportType,
    steps: args.steps,
    externalId: args.externalId,
    color: args.color,
  };

  const event = client.workoutBuilder.buildEvent(plan);
  const result = await client.createEvents([event]);

  return JSON.stringify(
    {
      success: true,
      created: result.length,
      events: result.map((e) => ({
        id: e.id,
        name: e.name,
        start_date_local: e.start_date_local,
        description: e.description,
      })),
    },
    null,
    2,
  );
}
