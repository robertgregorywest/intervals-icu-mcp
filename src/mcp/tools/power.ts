import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";

export const getPowerCurveSchema = z.object({
  type: z
    .string()
    .optional()
    .describe('Sport type filter, e.g. "Ride", "Run". Defaults to all types.'),
  range: z
    .string()
    .optional()
    .describe(
      'Time range for the curve: "90d" (90 days), "1y" (1 year), "all" (all time), ' +
        'or custom "r.YYYY-MM-DD.YYYY-MM-DD". Defaults to API default.'
    ),
});

export async function getPowerCurve(
  client: IIntervalsClient,
  args: z.infer<typeof getPowerCurveSchema>
): Promise<string> {
  const curve = await client.getPowerCurve(args);
  return JSON.stringify(curve, null, 2);
}
