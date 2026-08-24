import type { IActivitiesApi } from "../activities/index.js";
import type { IEventsApi } from "../events/index.js";
import type { IWellnessApi } from "../wellness/index.js";

export interface TrainingWeekDeps {
  activitiesApi: IActivitiesApi;
  wellnessApi: IWellnessApi;
  eventsApi: IEventsApi;
}

export interface SportTotals {
  count: number;
  tss: number;
  hours: number;
}

export interface FitnessDelta {
  startDate: string;
  endDate: string;
  ctl: { start: number; end: number; delta: number };
  atl: { start: number; end: number; delta: number };
  tsb: { start: number; end: number };
}

export interface ActivitySummary {
  id: number | string | null | undefined;
  date: string | null | undefined;
  type: string | null | undefined;
  name: string | null | undefined;
  source: string | null;
  tss: number;
  durationMin: number;
  distanceKm: number | null;
  avgWatts: number | null;
  avgHr: number | null;
}

export interface EventSummary {
  id: number | string | null | undefined;
  date: string | null | undefined;
  category: string | null | undefined;
  type: string | null | undefined;
  name: string | null | undefined;
}

export interface TrainingWeekSummary {
  week: { start: string; end: string };
  totals: {
    activityCount: number;
    tss: number;
    durationSeconds: number;
    durationHours: number;
  };
  bySport: Record<string, SportTotals>;
  fitness: FitnessDelta | null;
  completedActivities: ActivitySummary[];
  events: EventSummary[];
}

export interface ITrainingWeek {
  getTrainingWeekSummary(weekStart?: string): Promise<TrainingWeekSummary>;
}
