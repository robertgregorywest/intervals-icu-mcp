import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";
import { withCharacterLimit } from "./common.js";

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
        'or custom "r.YYYY-MM-DD.YYYY-MM-DD". ' +
        'Example: "r.2026-01-01.2026-03-31" for Q1 2026. ' +
        "Defaults to API default."
    ),
});

export async function getPowerCurve(
  client: IIntervalsClient,
  args: z.infer<typeof getPowerCurveSchema>
): Promise<unknown> {
  const curve = await client.getPowerCurve(args);
  return withCharacterLimit(
    { points: curve },
    "Power curve payload exceeds character limit. Narrow the range parameter."
  );
}
