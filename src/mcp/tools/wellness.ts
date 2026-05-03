import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";
import {
  applyLimit,
  assertDateRange,
  dateString,
  limitField,
} from "./common.js";

export const getWellnessSchema = z.object({
  oldest: dateString.describe("Start date in YYYY-MM-DD format"),
  newest: dateString.describe("End date in YYYY-MM-DD format"),
  limit: limitField.optional(),
});

export const getWellnessOutputSchema = z
  .object({
    total: z.number(),
    count: z.number(),
    truncated: z.boolean(),
    message: z.string().optional(),
    records: z.array(z.object({}).passthrough()),
  })
  .passthrough();

export async function getWellness(
  client: IIntervalsClient,
  args: z.infer<typeof getWellnessSchema>
): Promise<z.infer<typeof getWellnessOutputSchema>> {
  assertDateRange(args.oldest, args.newest);
  const all = await client.getWellness(args.oldest, args.newest);
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
    records: items as Array<Record<string, unknown>>,
  };
}

export const getFitnessSummarySchema = z.object({});

export async function getFitnessSummary(
  client: IIntervalsClient
): Promise<Record<string, unknown>> {
  return (await client.getFitnessSummary()) as Record<string, unknown>;
}
