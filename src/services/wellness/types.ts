export interface WellnessRecord {
  id: string;
  ctl: number;
  atl: number;
  rampRate: number;
  ctlLoad: number;
  atlLoad: number;
  weight: number | null;
  restingHR: number | null;
  hrv: number | null;
  hrvSDNN: number | null;
  sleepSecs: number | null;
  sleepScore: number | null;
  sleepQuality: number | null;
  fatigue: number | null;
  mood: number | null;
  motivation: number | null;
  soreness: number | null;
  stress: number | null;
  injury: number | null;
  spO2: number | null;
  readiness: number | null;
  baevskySI: number | null;
  respiration: number | null;
  menstrualPhase: string | null;
  menstrualPhasePredicted: string | null;
  [key: string]: unknown;
}
