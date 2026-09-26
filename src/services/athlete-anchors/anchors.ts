import type { IAthleteApi } from "../athlete/index.js";
import type { IActivitiesApi } from "../activities/index.js";
import type { IPowerCurvesApi } from "../power-curves/index.js";
import type { IntervalsEvent } from "../../types.js";
import { isoToday } from "../../clock.js";
import { deriveLatestMap } from "../map/index.js";
import { computeZones, extractPeaks } from "../power-profile/index.js";
import { positiveNumber, readAthlete } from "./fields.js";
import type { AthleteAnchors, IAthleteAnchors, MapAnchors } from "./types.js";

export interface AthleteAnchorsDeps {
  athleteApi: IAthleteApi;
  activitiesApi: IActivitiesApi;
  powerCurvesApi: IPowerCurvesApi;
  /** "Today" as YYYY-MM-DD; defaults to the system clock (UTC). */
  today?: () => string;
}

/**
 * The athlete's training anchors, each fetched only as far as it needs.
 *
 * FTP is one athlete request. MAP and its zones are the ramp-test derivation
 * plus the power curve, and never touch the athlete record or wellness — so a
 * caller that wants FTP no longer pays for the coaching context.
 */
export class AthleteAnchorsService implements IAthleteAnchors {
  constructor(private deps: AthleteAnchorsDeps) {}

  async getAthleteAnchors(): Promise<AthleteAnchors> {
    const { ftp, weight, powerZones } = readAthlete(
      await this.deps.athleteApi.getAthlete()
    );
    return { ftp, weight, powerZones };
  }

  async getMapAnchors(opts: { today?: string } = {}): Promise<MapAnchors> {
    return deriveMapAnchors(
      this.deps,
      opts.today ?? (this.deps.today ?? isoToday)()
    );
  }
}

export function createAthleteAnchors(
  deps: AthleteAnchorsDeps
): AthleteAnchorsService {
  return new AthleteAnchorsService(deps);
}

/**
 * MAP from the latest ramp test, and the MAP zones anchored on it. The power
 * curve's 5s peak only caps the NMP zone, so a curve that will not load
 * degrades that one cap rather than failing the zones.
 */
export async function deriveMapAnchors(
  deps: Pick<AthleteAnchorsDeps, "activitiesApi" | "powerCurvesApi">,
  today: string
): Promise<MapAnchors> {
  const [{ map, mapWarning }, curveRaw] = await Promise.all([
    deriveLatestMap(deps.activitiesApi, today),
    deps.powerCurvesApi
      .getPowerCurve({ range: "90d", type: "Ride" })
      .catch(() => null),
  ]);
  const mapZones = map
    ? computeZones(map.watts, extractPeaks(curveRaw).p5s)
    : null;
  return { map, mapZones, ...(mapWarning ? { mapWarning } : {}) };
}

/**
 * The FTP a planned event's percentages are read against — the one fallback
 * order every lens shares: the event's own FTP, then the FTP the paired ride was
 * recorded at, then the athlete's current FTP.
 *
 * Planned events on Intervals.icu carry no `icu_ftp` in practice, so the ride's
 * FTP is what usually decides. A lens that resolved the same event differently
 * would judge a step against a different target than its neighbour selected it
 * by. The athlete lookup is lazy: it runs only when neither half carries one.
 */
export async function planFtp(
  event: Pick<IntervalsEvent, "icu_ftp">,
  activity: { icu_ftp?: unknown } | null | undefined,
  athleteFtp: () => Promise<number | null | undefined>
): Promise<number | null> {
  return (
    positiveNumber(event as Record<string, unknown>, ["icu_ftp"]) ??
    positiveNumber(activity as Record<string, unknown> | undefined, [
      "icu_ftp",
    ]) ??
    positiveNumber({ ftp: await athleteFtp() }, ["ftp"])
  );
}
