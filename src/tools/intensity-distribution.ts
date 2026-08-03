import { z } from "zod";
import type { IIntervalsClient } from "../index.js";

// Plain object rather than a `.refine()`d one, matching compare_planned_vs_actual:
// the MCP adapter registers `schema.shape`, which a ZodEffects wrapper does not
// expose. The single-session / range choice is enforced in the handler.
export const compareIntensityDistributionSchema = z.object({
  activityId: z
    .union([z.string(), z.number()])
    .optional()
    .describe(
      'Completed activity ID (e.g. "i171371339" from get_activities, or a bare ' +
        "number). The planned event is resolved from the activity's paired event. " +
        "Single-session form: supply exactly one of activityId or eventId."
    ),
  eventId: z
    .number()
    .optional()
    .describe(
      "Planned event ID. The completed activity is located by scanning a " +
        "narrow date window for the ride paired to this event."
    ),
  oldest: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      "Range form: start date (YYYY-MM-DD). Supply with `newest` and neither " +
        "identifier. Maximum 28 days."
    ),
  newest: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Range form: end date (YYYY-MM-DD), inclusive."),
});

const zoneName = z.enum([
  "REC",
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "NMP",
]);

const reasonCode = z.enum([
  "no-paired-event",
  "no-paired-activity",
  "no-structured-steps",
  "no-recorded-power",
  "no-coaching-zones",
]);

const partitionBand = z.object({
  name: zoneName,
  lowW: z.number(),
  highW: z.number().optional(),
  coachingHighW: z.number(),
});

const zoneRow = z.object({
  zone: zoneName,
  lowW: z.number(),
  highW: z.number().optional(),
  plannedSeconds: z.number(),
  deliveredSeconds: z.number(),
  deltaSeconds: z.number(),
});

const middleBand = z.object({
  lowW: z.number(),
  highW: z.number(),
  lowPctFtp: z.number(),
  highPctFtp: z.number(),
  plannedSeconds: z.number(),
  deliveredSeconds: z.number(),
  deltaSeconds: z.number(),
  deliveredFraction: z.number().optional(),
});

export const compareIntensityDistributionOutputSchema = z.object({
  // Single-session form.
  activityId: z.string().optional(),
  eventId: z.number().optional(),
  activityName: z.string().optional(),
  eventName: z.string().optional(),
  date: z.string().optional(),
  plannedTotalSeconds: z.number().optional(),
  deliveredTotalSeconds: z.number().optional(),
  unbucketedSteps: z
    .array(
      z.object({
        index: z.number(),
        label: z.string().optional(),
        durationSeconds: z.number().optional(),
        reason: z.string(),
      })
    )
    .optional(),
  boundarySpanningSteps: z
    .array(
      z.object({
        index: z.number(),
        label: z.string().optional(),
        lowW: z.number(),
        highW: z.number(),
        assignedZone: zoneName,
        midpointW: z.number(),
      })
    )
    .optional(),
  reason: reasonCode.optional(),
  message: z.string().optional(),

  // Range form.
  oldest: z.string().optional(),
  newest: z.string().optional(),
  sessions: z
    .array(
      z.object({
        date: z.string().optional(),
        activityId: z.string().optional(),
        eventId: z.number().optional(),
        name: z.string().optional(),
        middleBandPlannedSeconds: z.number(),
        middleBandDeliveredSeconds: z.number(),
        middleBandDeliveredFraction: z.number().optional(),
      })
    )
    .optional(),
  excluded: z
    .array(
      z.object({
        date: z.string().optional(),
        activityId: z.string().optional(),
        eventId: z.number().optional(),
        name: z.string().optional(),
        reason: reasonCode,
        message: z.string(),
      })
    )
    .optional(),

  // Both forms.
  boundaries: z.array(partitionBand).optional(),
  zones: z.array(zoneRow).optional(),
  middleBand: middleBand.optional(),
});

export async function compareIntensityDistribution(
  client: IIntervalsClient,
  args: z.infer<typeof compareIntensityDistributionSchema>
): Promise<z.infer<typeof compareIntensityDistributionOutputSchema>> {
  const hasRange = !!args.oldest || !!args.newest;
  const hasSession = !!args.activityId || !!args.eventId;

  // Checked here so the caller gets the explanation before any request is made;
  // the service guards the same rules.
  if (hasRange && hasSession) {
    throw new Error(
      "Supply either a single session (activityId or eventId) or a date range " +
        "(oldest and newest) — not both."
    );
  }

  if (hasRange) {
    if (!args.oldest || !args.newest) {
      throw new Error(
        "The range form needs both oldest and newest (YYYY-MM-DD)."
      );
    }
    return client.compareIntensityDistributionRange({
      oldest: args.oldest,
      newest: args.newest,
    });
  }

  if (!!args.activityId === !!args.eventId) {
    throw new Error(
      "Supply exactly one of activityId or eventId — the other half of the " +
        "pair is resolved automatically from the activity's paired event. " +
        "For a window of sessions, supply oldest and newest instead."
    );
  }

  return client.compareIntensityDistribution({
    activityId:
      args.activityId === undefined
        ? undefined
        : normalizeActivityId(args.activityId),
    eventId: args.eventId,
  });
}

function normalizeActivityId(id: string | number): string {
  if (typeof id === "number") return `i${id}`;
  return id.startsWith("i") ? id : `i${id}`;
}
