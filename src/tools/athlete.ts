import { z } from "zod";
import type { IIntervalsClient } from "../index.js";

export const getAthleteSchema = z.object({});

export async function getAthlete(
  client: IIntervalsClient
): Promise<Record<string, unknown>> {
  const profile = (await client.getAthlete()) as Record<string, unknown>;
  return profile;
}
