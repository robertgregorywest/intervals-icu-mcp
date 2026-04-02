export interface WellnessRecord {
  id: string;
  date: string;
  ctl: number;
  atl: number;
  rampRate: number;
  ctl2: number;
  atl2: number;
  weight: number;
  restingHR: number;
  hrv: number;
  hrvSDNN: number;
  sleepTime: number;
  sleepQuality: number;
  fatigue: number;
  mood: number;
  motivation: number;
  injury: number;
  spO2: number;
  readiness: number;
  baevskySI: number;
  menstrualPhase: string;
  menstrualPhasePredicted: string;
  [key: string]: unknown;
}
