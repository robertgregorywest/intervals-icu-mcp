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

export async function getWellness(
  client: IIntervalsClient,
  args: z.infer<typeof getWellnessSchema>
): Promise<string> {
  assertDateRange(args.oldest, args.newest);
  const all = await client.getWellness(args.oldest, args.newest);
  const limit = args.limit ?? 50;
  const { items, total, truncated } = applyLimit(all, limit);
  return JSON.stringify(
    {
      total,
      count: items.length,
      truncated,
      ...(truncated
        ? {
            message:
              "Result list truncated. Increase 'limit' or narrow the date range.",
          }
        : {}),
      records: items,
    },
    null,
    2
  );
}

export const getFitnessSummarySchema = z.object({});

export async function getFitnessSummary(
  client: IIntervalsClient
): Promise<string> {
  const summary = await client.getFitnessSummary();
  return JSON.stringify(summary, null, 2);
}
