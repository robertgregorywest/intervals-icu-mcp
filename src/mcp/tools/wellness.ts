import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";

export const getWellnessSchema = z.object({
  oldest: z.string().describe("Start date in YYYY-MM-DD format"),
  newest: z.string().describe("End date in YYYY-MM-DD format"),
});

export async function getWellness(
  client: IIntervalsClient,
  args: z.infer<typeof getWellnessSchema>
): Promise<string> {
  const wellness = await client.getWellness(args.oldest, args.newest);
  return JSON.stringify(wellness, null, 2);
}

export const getFitnessSummarySchema = z.object({});

export async function getFitnessSummary(
  client: IIntervalsClient
): Promise<string> {
  const summary = await client.getFitnessSummary();
  return JSON.stringify(summary, null, 2);
}
