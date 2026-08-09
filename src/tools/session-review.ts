import { z } from "zod";
import type { IIntervalsClient } from "../index.js";

// Deliberately a plain object rather than a `.refine()`d one: the MCP adapter
// registers `schema.shape`, which a ZodEffects wrapper does not expose. The
// exactly-one rule is enforced in the handler below instead.
export const comparePlannedVsActualSchema = z.object({
  activityId: z
    .union([z.string(), z.number()])
    .optional()
    .describe(
      'Completed activity ID (e.g. "i171371339" from get_activities, or a bare ' +
        "number). The planned event is resolved from the activity's paired event."
    ),
  eventId: z
    .number()
    .optional()
    .describe(
      "Planned event ID. The completed activity is located by scanning a " +
        "narrow date window for the ride paired to this event."
    ),
  tolerance: z
    .number()
    .positive()
    .max(1)
    .optional()
    .describe(
      "Power tolerance as a fraction for point targets (default: 0.05 = ±5%). " +
        "Range targets are judged on their own band and are not widened by this."
    ),
});

const powerTargetShape = z.object({
  watts: z.number().optional(),
  low: z.number().optional(),
  high: z.number().optional(),
  ramp: z.boolean().optional(),
});

const alignedStepShape = z.object({
  index: z.number(),
  label: z.string().optional(),
  repIndex: z.number().optional(),
  repCount: z.number().optional(),
  stepInRep: z.number().optional(),
  planned: z.object({
    durationSeconds: z.number().optional(),
    target: powerTargetShape.optional(),
    cadence: z.number().optional(),
  }),
  delivered: z
    .object({
      intervalIndex: z.number(),
      durationSeconds: z.number(),
      averageWatts: z.number().optional(),
      averageCadence: z.number().optional(),
      averageHeartrate: z.number().optional(),
    })
    .optional(),
  deltas: z
    .object({
      durationSeconds: z.number().optional(),
      watts: z.number().optional(),
      wattsFraction: z.number().optional(),
    })
    .optional(),
  verdict: z.enum(["on-target", "over", "under", "not-attempted", "unmatched"]),
  note: z.string().optional(),
});

export const comparePlannedVsActualOutputSchema = z.object({
  activityId: z.string().optional(),
  eventId: z.number().optional(),
  activityName: z.string().optional(),
  eventName: z.string().optional(),
  date: z.string().optional(),
  tolerance: z.number(),
  executionRecord: z
    .enum(["device-laps", "detected-intervals"])
    .describe(
      "Which record of the ride the step comparison was read from. " +
        "'device-laps' is the faithful record the head unit wrote; " +
        "'detected-intervals' is Intervals.icu's derived, editable segmentation, " +
        "used only when laps are unavailable or cannot explain the session."
    ),
  executionRecordNote: z
    .string()
    .optional()
    .describe(
      "Present when the derived intervals were used and are known to have " +
        "drifted from the recorded laps — read per-step power with caution."
    ),
  alignmentBasis: z.enum(["sequential", "duration", "none"]),
  matchedFraction: z.number(),
  steps: z.array(alignedStepShape),
  rollup: z.object({
    plannedLoad: z.number().optional(),
    actualLoad: z.number().optional(),
    plannedDurationSeconds: z.number().optional(),
    actualDurationSeconds: z.number().optional(),
    platformCompliance: z.number().optional(),
    unplannedIntervals: z.array(
      z.object({
        intervalIndex: z.number(),
        type: z.string().optional(),
        durationSeconds: z.number(),
        averageWatts: z.number().optional(),
      })
    ),
  }),
  reason: z
    .enum([
      "no-paired-event",
      "no-paired-activity",
      "no-structured-steps",
      "no-intervals",
      "alignment-failed",
    ])
    .optional(),
  message: z.string().optional(),
});

export async function comparePlannedVsActual(
  client: IIntervalsClient,
  args: z.infer<typeof comparePlannedVsActualSchema>
): Promise<z.infer<typeof comparePlannedVsActualOutputSchema>> {
  // Caught here rather than in the schema so the caller gets the explanation
  // before any request is made; the service guards the same rule.
  if (!!args.activityId === !!args.eventId) {
    throw new Error(
      "Supply exactly one of activityId or eventId — the other half of the " +
        "pair is resolved automatically from the activity's paired event."
    );
  }

  return client.comparePlannedVsActual({
    activityId:
      args.activityId === undefined
        ? undefined
        : normalizeActivityId(args.activityId),
    eventId: args.eventId,
    tolerance: args.tolerance,
  });
}

function normalizeActivityId(id: string | number): string {
  if (typeof id === "number") return `i${id}`;
  return id.startsWith("i") ? id : `i${id}`;
}
