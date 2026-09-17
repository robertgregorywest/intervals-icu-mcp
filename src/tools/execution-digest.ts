import { z } from "zod";
import type { IIntervalsClient } from "../index.js";

export const getExecutionDigestSchema = z.object({
  oldest: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(
      "Window start (YYYY-MM-DD). The coaching log's `reviewed-through` " +
        "watermark, not a date derived from conversation history."
    ),
  newest: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Window end (YYYY-MM-DD), inclusive. Maximum 28 days."),
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

const powerTarget = z.object({
  watts: z.number().optional(),
  low: z.number().optional(),
  high: z.number().optional(),
  ramp: z.boolean().optional(),
});

const flaggedStep = z.object({
  index: z.number(),
  repIndex: z.number().optional(),
  repCount: z.number().optional(),
  stepInRep: z.number().optional(),
  durationSeconds: z.number().optional(),
  target: powerTarget.optional(),
  verdict: z.enum(["on-target", "over", "under", "not-attempted", "unmatched"]),
  verdictBasis: z.enum([
    "average-watts",
    "normalized-power",
    "normalized-power-fallback",
  ]),
  deltas: z
    .object({
      watts: z.number().optional(),
      wattsFraction: z.number().optional(),
      cadence: z.number().optional(),
    })
    .optional(),
  cadenceVerdict: z.enum(["on-target", "over", "under"]).optional(),
  coastingFraction: z.number().optional(),
});

const digestSession = z.object({
  eventId: z.number().optional(),
  activityId: z.string().optional(),
  date: z.string().optional(),
  name: z.string().optional(),
  executionRecord: z.enum(["device-laps", "detected-intervals"]),
  executionRecordNote: z.string().optional(),
  alignmentBasis: z.enum(["sequential", "duration", "none"]),
  workSteps: z.number(),
  unclassifiedSteps: z.number(),
  flagged: z.array(flaggedStep),
  cadence: z
    .object({ judged: z.number(), missed: z.number() })
    .optional()
    .describe(
      "Cadence across the session's work steps. A cadence missed on every rep " +
        "is one finding about the session, not a detail on each rep."
    ),
  middleBandPlannedSeconds: z.number().optional(),
  middleBandDeliveredSeconds: z.number().optional(),
  middleBandDeliveredFraction: z.number().optional(),
  platformCompliance: z.number().optional(),
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

export const getExecutionDigestOutputSchema = z.object({
  oldest: z.string(),
  newest: z.string(),
  status: z.enum(["reviewed", "skipped"]),
  reviewedThrough: z.string().optional(),
  message: z.string().optional(),
  middleBand: z
    .object({
      lowW: z.number(),
      highW: z.number(),
      lowPctFtp: z.number(),
      highPctFtp: z.number(),
      plannedSeconds: z.number(),
      deliveredSeconds: z.number(),
      deltaSeconds: z.number(),
      deliveredFraction: z.number().optional(),
    })
    .optional(),
  zones: z
    .array(
      z.object({
        zone: zoneName,
        lowW: z.number(),
        highW: z.number().optional(),
        plannedSeconds: z.number(),
        deliveredSeconds: z.number(),
        deltaSeconds: z.number(),
      })
    )
    .optional(),
  boundaries: z
    .array(
      z.object({
        name: zoneName,
        lowW: z.number(),
        highW: z.number().optional(),
        coachingHighW: z.number(),
      })
    )
    .optional(),
  sessions: z.array(digestSession),
  excluded: z.array(
    z.object({
      date: z.string().optional(),
      activityId: z.string().optional(),
      eventId: z.number().optional(),
      name: z.string().optional(),
      reason: z.enum([
        "no-paired-event",
        "no-paired-activity",
        "no-structured-steps",
        "no-recorded-power",
        "no-coaching-zones",
      ]),
    })
  ),
  nonKeySessions: z.number(),
});

export async function getExecutionDigest(
  client: IIntervalsClient,
  args: z.infer<typeof getExecutionDigestSchema>
) {
  return client.getExecutionDigest({
    oldest: args.oldest,
    newest: args.newest,
  });
}
