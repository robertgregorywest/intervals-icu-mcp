import { prescriptionShape } from "../services/prescription/index.js";
import { z } from "zod";
import type { IIntervalsClient } from "../index.js";
import {
  applyLimit,
  assertDateRange,
  dateString,
  limitField,
} from "./common.js";
import { repeatBlockSchema, workoutStepSchema } from "./workouts.js";

const eventCategoryEnum = z.enum([
  "WORKOUT",
  "NOTE",
  "RACE_A",
  "RACE_B",
  "RACE_C",
  "HOLIDAY",
  "SICK",
  "INJURED",
]);

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

export const getEventsSchema = z.object({
  oldest: dateString.describe("Start date in YYYY-MM-DD format"),
  newest: dateString.describe("End date in YYYY-MM-DD format"),
  limit: limitField.optional(),
});

export const getEventsOutputSchema = z
  .object({
    total: z.number(),
    count: z.number(),
    truncated: z.boolean(),
    message: z.string().optional(),
    events: z.array(z.object({}).passthrough()),
  })
  .passthrough();

export async function getEvents(
  client: IIntervalsClient,
  args: z.infer<typeof getEventsSchema>
): Promise<z.infer<typeof getEventsOutputSchema>> {
  assertDateRange(args.oldest, args.newest);
  const all = await client.getEvents(args.oldest, args.newest);
  const limit = args.limit ?? 50;
  const { items, total, truncated } = applyLimit(all, limit);
  return {
    total,
    count: items.length,
    truncated,
    ...(truncated
      ? {
          message:
            "Result list truncated. Increase 'limit' or narrow the date range.",
        }
      : {}),
    events: items as unknown as Array<Record<string, unknown>>,
  };
}

export const getEventSchema = z.object({
  id: z.number().describe("Event ID"),
});

export async function getEvent(
  client: IIntervalsClient,
  args: z.infer<typeof getEventSchema>
): Promise<Record<string, unknown>> {
  return (await client.getEvent(args.id)) as unknown as Record<string, unknown>;
}

export const updateEventSchema = z.object({
  id: z.number().describe("Event ID to update"),
  name: z.string().optional().describe("Updated event name"),
  description: z
    .string()
    .optional()
    .describe(
      "Updated description. Mutually exclusive with 'steps'. " +
        "On a WORKOUT event whose workout has steps, a description that " +
        "contains no step lines is refused — Intervals.icu reparses it as " +
        "workout-text and would collapse workout_doc.steps. Prose plus step " +
        "lines is accepted. Pass 'steps' (and 'notes') to rebuild structure."
    ),
  steps: z
    .array(z.union([workoutStepSchema, repeatBlockSchema]))
    .min(1)
    .optional()
    .describe(
      "Updated workout steps (same shape as create_workout). When supplied, " +
        "the description is rebuilt from these so workout_doc.steps is preserved. " +
        "Mutually exclusive with 'description'."
    ),
  notes: z
    .string()
    .optional()
    .describe(
      "Session-level prose emitted above the rebuilt step lines. Requires 'steps'."
    ),
  date: dateString.optional().describe("Updated date in YYYY-MM-DD format"),
  category: eventCategoryEnum.optional().describe("Updated event category"),
  type: sportTypeEnum.optional().describe("Updated sport type"),
  color: z.string().optional().describe("Updated event color"),
});

export async function updateEvent(
  client: IIntervalsClient,
  args: z.infer<typeof updateEventSchema>
): Promise<Record<string, unknown>> {
  const { id, date, steps, notes, description, name, category, type, color } =
    args;

  if (steps && description !== undefined) {
    throw new Error(
      "update_event: 'steps' and 'description' are mutually exclusive. " +
        "Use 'steps' to update workout structure (description is rebuilt from it), " +
        "or 'description' alone for prose-only updates on non-WORKOUT events."
    );
  }

  if (notes !== undefined && !steps) {
    throw new Error(
      "update_event: 'notes' requires 'steps' — the description is rebuilt " +
        "from steps with notes above them."
    );
  }

  // Guard against the issue-#1 bug: PUT /events/{id} with a `description` body
  // makes Intervals.icu reparse the text as workout-text. On a structured
  // WORKOUT event, anything that isn't a valid step line collapses
  // workout_doc.steps. Force callers to use `steps` for WORKOUT updates.
  if (description !== undefined && !steps) {
    const existing = await client.getEvent(id);
    const hasSteps = (existing.workout_doc?.steps?.length ?? 0) > 0;
    if (
      existing.category === "WORKOUT" &&
      hasSteps &&
      prescriptionShape(description).stepCount === 0
    ) {
      throw new Error(
        "update_event: refusing to update 'description' on a WORKOUT event — " +
          "it contains no step lines, so Intervals.icu would reparse it and " +
          "collapse workout_doc.steps. Include the step lines in the " +
          "description, or pass 'steps' (and 'notes') to rebuild it, or " +
          "update the metadata fields only (name, date, color, category, type)."
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (category !== undefined) data.category = category;
  if (type !== undefined) data.type = type;
  if (color !== undefined) data.color = color;
  if (date) data.start_date_local = `${date}T00:00:00`;
  if (description !== undefined) data.description = description;
  if (steps) data.description = client.buildWorkoutDescription(steps, notes);

  return (await client.updateEvent(id, data)) as unknown as Record<
    string,
    unknown
  >;
}

export const deleteEventsSchema = z.object({
  ids: z
    .array(
      z.union([
        z.object({ id: z.number().describe("Event ID") }).strict(),
        z.object({ external_id: z.string().describe("External ID") }).strict(),
      ])
    )
    .min(1)
    .describe(
      "Array of identifiers to delete. Each item must be exactly one of " +
        "{ id: number } or { external_id: string }."
    ),
});

export const deleteEventsOutputSchema = z.object({
  success: z.literal(true),
  deleted: z.number().describe("Number of identifiers submitted for deletion"),
});

export async function deleteEvents(
  client: IIntervalsClient,
  args: z.infer<typeof deleteEventsSchema>
): Promise<z.infer<typeof deleteEventsOutputSchema>> {
  await client.deleteEvents(args.ids);
  return { success: true, deleted: args.ids.length };
}
