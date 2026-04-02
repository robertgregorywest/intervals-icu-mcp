import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";

export const getAthleteSchema = z.object({});

export async function getAthlete(client: IIntervalsClient): Promise<string> {
  const profile = await client.getAthlete();
  return JSON.stringify(profile, null, 2);
}
