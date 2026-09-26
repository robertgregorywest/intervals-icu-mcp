import type { MapInfo } from "../map/index.js";
import type { ZoneRow } from "../power-profile/index.js";

/** What the athlete record anchors: one request, no derivation. */
export interface AthleteAnchors {
  ftp: number | null;
  weight: number | null;
  /** The cycling FTP zones as %FTP boundaries — for resolving `Z3`-style targets. */
  powerZones: number[] | null;
}

/** MAP from the latest ramp test and the MAP zones on it. See ADR 0003. */
export interface MapAnchors {
  map: MapInfo | null;
  /** `null` when MAP is unavailable (see mapWarning). */
  mapZones: ZoneRow[] | null;
  mapWarning?: string;
}

export interface IAthleteAnchors {
  getAthleteAnchors(): Promise<AthleteAnchors>;
  getMapAnchors(opts?: { today?: string }): Promise<MapAnchors>;
}
