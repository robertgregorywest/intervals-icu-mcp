import type { AthleteProfile, Zone } from "../athlete/index.js";
import type { WellnessRecord } from "../wellness/index.js";

export interface AthleteSnapshot {
  id: string | null;
  name: string | null;
  weight: number | null;
  ftp: number | null;
  lthr: number | null;
  max_hr: number | null;
  resting_hr: number | null;
  power_zones: Zone[] | null;
  hr_zones: Zone[] | null;
  pace_zones: Zone[] | null;
  sport_settings_count: number;
}

export interface FitnessSnapshot {
  date: string | null;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  ramp_rate: number | null;
}

export interface WellnessTrendPoint {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  fatigue: number | null;
  soreness: number | null;
  motivation: number | null;
  mood: number | null;
  stress: number | null;
  readiness: number | null;
  sleep_secs: number | null;
  sleep_score: number | null;
  resting_hr: number | null;
  hrv: number | null;
}

export interface CoachingContext {
  asOf: string;
  daysWindow: number;
  athlete: AthleteSnapshot;
  fitness: FitnessSnapshot;
  wellnessTrend: WellnessTrendPoint[];
}

export type RawAthlete = AthleteProfile;
export type RawWellness = WellnessRecord;
