export type EventCategory =
  | "WORKOUT"
  | "NOTE"
  | "RACE_A"
  | "RACE_B"
  | "RACE_C"
  | "HOLIDAY"
  | "SICK"
  | "INJURED";

export type SportType =
  | "Ride"
  | "Run"
  | "Swim"
  | "VirtualRide"
  | "MountainBikeRide"
  | "GravelRide"
  | "TrailRun"
  | "WeightTraining"
  | "Yoga"
  | "Hike"
  | "OpenWaterSwim";

export interface IntervalsEvent {
  id?: number;
  uid?: string;
  category: EventCategory;
  start_date_local: string;
  type: SportType;
  name: string;
  description: string;
  external_id?: string;
  color?: string;
}

export interface ClientConfig {
  apiKey: string;
  athleteId: string;
  baseUrl: string;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}
