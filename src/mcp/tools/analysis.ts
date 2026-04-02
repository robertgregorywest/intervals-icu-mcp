import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";

export const getAerobicDecouplingSchema = z.object({
  activityId: z.number().describe("Activity ID to analyze"),
});

export async function getAerobicDecoupling(
  client: IIntervalsClient,
  args: z.infer<typeof getAerobicDecouplingSchema>
): Promise<string> {
  const result = await client.getAerobicDecoupling(args.activityId);
  return JSON.stringify(result, null, 2);
}

export const compareIntervalsSchema = z.object({
  activityIds: z
    .array(z.number())
    .describe("Activity IDs to compare intervals across"),
  minPower: z
    .number()
    .optional()
    .describe("Minimum average power (watts) to include an interval"),
  targetDuration: z
    .number()
    .optional()
    .describe(
      "Target interval duration in seconds — filters to matching intervals"
    ),
  durationTolerance: z
    .number()
    .optional()
    .describe(
      "Tolerance for duration filter as a fraction (default: 0.2 = ±20%)"
    ),
});

export async function compareIntervalsHandler(
  client: IIntervalsClient,
  args: z.infer<typeof compareIntervalsSchema>
): Promise<string> {
  const result = await client.compareIntervals(args.activityIds, {
    minPower: args.minPower,
    targetDuration: args.targetDuration,
    durationTolerance: args.durationTolerance,
  });
  return JSON.stringify(result, null, 2);
}
