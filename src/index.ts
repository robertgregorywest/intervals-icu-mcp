import { createHttpClient } from "./client.js";
import type { IHttpClient } from "./client.js";
import { createEventsApi } from "./services/events/index.js";
import type { IEventsApi } from "./services/events/index.js";
import { createWorkoutBuilder } from "./services/workout-builder/index.js";
import type { IWorkoutBuilder } from "./services/workout-builder/index.js";
import { createAthleteApi } from "./services/athlete/index.js";
import type { IAthleteApi, AthleteProfile } from "./services/athlete/index.js";
import { createActivitiesApi } from "./services/activities/index.js";
import type { IActivitiesApi } from "./services/activities/index.js";
import type { Activity, ActivityStreams } from "./services/activities/index.js";
import { createWellnessApi } from "./services/wellness/index.js";
import type { IWellnessApi } from "./services/wellness/index.js";
import type { WellnessRecord } from "./services/wellness/index.js";
import { createPowerCurvesApi } from "./services/power-curves/index.js";
import type {
  IPowerCurvesApi,
  PowerCurveOptions,
} from "./services/power-curves/index.js";
import type { PowerCurvePoint } from "./services/power-curves/index.js";
import {
  createWorkoutLibraryApi,
  createWorkoutLibrary,
} from "./services/workout-library/index.js";
import type { IWorkoutLibrary } from "./services/workout-library/index.js";
import { computeAerobicDecoupling } from "./services/analysis/index.js";
import type { DecouplingResult } from "./services/analysis/index.js";
import { compareIntervals as compareIntervalsAnalysis } from "./services/analysis/index.js";
import type {
  CompareIntervalsResult,
  IntervalFilterOptions,
} from "./services/analysis/index.js";
import { buildCoachingContext } from "./services/coaching-context/index.js";
import type {
  CoachingContext,
  CoachingContextOptions,
} from "./services/coaching-context/index.js";
import type { IntervalsEvent, ClientConfig } from "./types.js";

export interface IIntervalsClient {
  readonly events: IEventsApi;
  readonly workoutBuilder: IWorkoutBuilder;
  readonly athlete: IAthleteApi;
  readonly activities: IActivitiesApi;
  readonly wellness: IWellnessApi;
  readonly powerCurves: IPowerCurvesApi;
  readonly workoutLibrary: IWorkoutLibrary;

  // Events
  getEvents(oldest: string, newest: string): Promise<IntervalsEvent[]>;
  getEvent(eventId: number): Promise<IntervalsEvent>;
  createEvents(events: IntervalsEvent[]): Promise<IntervalsEvent[]>;
  updateEvent(
    eventId: number,
    data: Partial<IntervalsEvent>
  ): Promise<IntervalsEvent>;
  deleteEvents(
    ids: Array<{ external_id?: string; id?: number }>
  ): Promise<void>;

  // Athlete
  getAthlete(): Promise<AthleteProfile>;

  // Activities
  getActivities(oldest: string, newest: string): Promise<Activity[]>;
  getActivity(id: number, includeIntervals?: boolean): Promise<Activity>;
  getActivityStreams(id: number, types?: string[]): Promise<ActivityStreams>;

  // Wellness
  getWellness(oldest: string, newest: string): Promise<WellnessRecord[]>;
  getFitnessSummary(): Promise<WellnessRecord>;

  // Power curves
  getPowerCurve(options?: PowerCurveOptions): Promise<PowerCurvePoint[]>;

  // Analysis
  getAerobicDecoupling(activityId: number): Promise<DecouplingResult>;
  compareIntervals(
    activityIds: number[],
    options?: IntervalFilterOptions
  ): Promise<CompareIntervalsResult>;

  // Coaching context
  getCoachingContext(opts?: CoachingContextOptions): Promise<CoachingContext>;
}

export interface IntervalsClientOptions {
  apiKey?: string;
  athleteId?: string;
  baseUrl?: string;
}

export class IntervalsClient implements IIntervalsClient {
  private httpClient: IHttpClient;
  readonly events: IEventsApi;
  readonly workoutBuilder: IWorkoutBuilder;
  readonly athlete: IAthleteApi;
  readonly activities: IActivitiesApi;
  readonly wellness: IWellnessApi;
  readonly powerCurves: IPowerCurvesApi;
  readonly workoutLibrary: IWorkoutLibrary;

  constructor(options: IntervalsClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.INTERVALS_API_KEY;
    const athleteId =
      options.athleteId ?? process.env.INTERVALS_ATHLETE_ID ?? "0";
    const baseUrl = options.baseUrl ?? "https://intervals.icu";

    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        "Intervals.icu API key required. " +
          "Provide apiKey in options or set INTERVALS_API_KEY env var."
      );
    }
    if (!/^[a-zA-Z0-9]+$/.test(athleteId)) {
      throw new Error(
        `Invalid athlete ID — must be alphanumeric (e.g. "0" or "i12345"), ` +
          `got ${JSON.stringify(athleteId)}.`
      );
    }
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("must use http or https");
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid base URL ${JSON.stringify(baseUrl)}: ${reason}`);
    }

    const config: ClientConfig = { apiKey, athleteId, baseUrl };
    this.httpClient = createHttpClient(config);
    this.events = createEventsApi(this.httpClient, athleteId);
    this.workoutBuilder = createWorkoutBuilder();
    this.athlete = createAthleteApi(this.httpClient, athleteId);
    this.activities = createActivitiesApi(this.httpClient, athleteId);
    this.wellness = createWellnessApi(this.httpClient, athleteId);
    this.powerCurves = createPowerCurvesApi(this.httpClient, athleteId);
    this.workoutLibrary = createWorkoutLibrary(
      createWorkoutLibraryApi(this.httpClient, athleteId),
      this.workoutBuilder
    );
  }

  // Events
  async getEvents(oldest: string, newest: string): Promise<IntervalsEvent[]> {
    return this.events.getEvents(oldest, newest);
  }

  async getEvent(eventId: number): Promise<IntervalsEvent> {
    return this.events.getEvent(eventId);
  }

  async createEvents(events: IntervalsEvent[]): Promise<IntervalsEvent[]> {
    return this.events.createEvents(events);
  }

  async updateEvent(
    eventId: number,
    data: Partial<IntervalsEvent>
  ): Promise<IntervalsEvent> {
    return this.events.updateEvent(eventId, data);
  }

  async deleteEvents(
    ids: Array<{ external_id?: string; id?: number }>
  ): Promise<void> {
    return this.events.deleteEvents(ids);
  }

  // Athlete
  async getAthlete(): Promise<AthleteProfile> {
    return this.athlete.getAthlete();
  }

  // Activities
  async getActivities(oldest: string, newest: string): Promise<Activity[]> {
    return this.activities.getActivities(oldest, newest);
  }

  async getActivity(id: number, includeIntervals?: boolean): Promise<Activity> {
    return this.activities.getActivity(id, includeIntervals);
  }

  async getActivityStreams(
    id: number,
    types?: string[]
  ): Promise<ActivityStreams> {
    return this.activities.getActivityStreams(id, types);
  }

  // Wellness
  async getWellness(oldest: string, newest: string): Promise<WellnessRecord[]> {
    return this.wellness.getWellness(oldest, newest);
  }

  async getFitnessSummary(): Promise<WellnessRecord> {
    const today = new Date().toISOString().slice(0, 10);
    return this.wellness.getWellnessDay(today);
  }

  // Power curves
  async getPowerCurve(options?: PowerCurveOptions): Promise<PowerCurvePoint[]> {
    return this.powerCurves.getPowerCurve(options);
  }

  // Analysis
  async getAerobicDecoupling(activityId: number): Promise<DecouplingResult> {
    const streams = await this.activities.getActivityStreams(activityId, [
      "watts",
      "heartrate",
    ]);
    if (!streams.watts?.length) {
      throw new Error("No power data available for this activity");
    }
    if (!streams.heartrate?.length) {
      throw new Error("No heart rate data available for this activity");
    }
    return computeAerobicDecoupling(streams.watts, streams.heartrate);
  }

  async compareIntervals(
    activityIds: number[],
    options?: IntervalFilterOptions
  ): Promise<CompareIntervalsResult> {
    const activities = await Promise.all(
      activityIds.map((id) => this.activities.getActivity(id, true))
    );
    return compareIntervalsAnalysis(activities, options);
  }

  // Coaching context
  async getCoachingContext(
    opts?: CoachingContextOptions
  ): Promise<CoachingContext> {
    return buildCoachingContext(
      { athleteApi: this.athlete, wellnessApi: this.wellness },
      opts
    );
  }
}

export function createClient(
  options?: IntervalsClientOptions
): IntervalsClient {
  return new IntervalsClient(options);
}

// Re-export types
export type {
  IntervalsEvent,
  EventCategory,
  SportType,
  ClientConfig,
} from "./types.js";
export type { IHttpClient } from "./client.js";
export { HttpError } from "./client.js";
export type { IEventsApi } from "./services/events/index.js";
export type { IWorkoutBuilder } from "./services/workout-builder/index.js";
export type {
  WorkoutStep,
  RepeatBlock,
  WorkoutPlan,
} from "./services/workout-builder/index.js";
export type {
  IAthleteApi,
  AthleteProfile,
  SportSetting,
  Zone,
} from "./services/athlete/index.js";
export type { IActivitiesApi } from "./services/activities/index.js";
export type {
  Activity,
  ActivityInterval,
  ActivityStreams,
} from "./services/activities/index.js";
export type { IWellnessApi } from "./services/wellness/index.js";
export type { WellnessRecord } from "./services/wellness/index.js";
export type {
  IPowerCurvesApi,
  PowerCurveOptions,
} from "./services/power-curves/index.js";
export type { PowerCurvePoint } from "./services/power-curves/index.js";
export type {
  DecouplingResult,
  DecouplingHalf,
} from "./services/analysis/index.js";
export type {
  CompareIntervalsResult,
  IntervalFilterOptions,
} from "./services/analysis/index.js";
export type {
  CoachingContext,
  CoachingContextOptions,
  AthleteSnapshot,
  FitnessSnapshot,
  WellnessTrendPoint,
} from "./services/coaching-context/index.js";
export type {
  IWorkoutLibrary,
  LibraryListing,
  LibraryItem,
  LibraryFolder,
  LibraryWorkout,
  LibraryWorkoutSummary,
  LibraryWorkoutInput,
  WorkoutSummary,
  Rationale,
  RationaleBasis,
  RationaleIntensity,
} from "./services/workout-library/index.js";
