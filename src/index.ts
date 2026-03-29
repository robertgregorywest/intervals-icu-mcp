import { createHttpClient } from "./client.js";
import type { IHttpClient } from "./client.js";
import { createEventsApi } from "./services/events/index.js";
import type { IEventsApi } from "./services/events/index.js";
import { createWorkoutBuilder } from "./services/workout-builder/index.js";
import type { IWorkoutBuilder } from "./services/workout-builder/index.js";
import type { IntervalsEvent, ClientConfig } from "./types.js";

export interface IIntervalsClient {
  readonly events: IEventsApi;
  readonly workoutBuilder: IWorkoutBuilder;
  createEvents(events: IntervalsEvent[]): Promise<IntervalsEvent[]>;
  deleteEvents(
    ids: Array<{ external_id?: string; id?: number }>,
  ): Promise<void>;
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

  constructor(options: IntervalsClientOptions = {}) {
    const apiKey = options.apiKey || process.env.INTERVALS_API_KEY;
    const athleteId =
      options.athleteId || process.env.INTERVALS_ATHLETE_ID || "0";
    const baseUrl = options.baseUrl || "https://intervals.icu";

    if (!apiKey) {
      throw new Error(
        "Intervals.icu API key required. " +
          "Provide apiKey in options or set INTERVALS_API_KEY env var.",
      );
    }

    const config: ClientConfig = { apiKey, athleteId, baseUrl };
    this.httpClient = createHttpClient(config);
    this.events = createEventsApi(this.httpClient, athleteId);
    this.workoutBuilder = createWorkoutBuilder();
  }

  async createEvents(events: IntervalsEvent[]): Promise<IntervalsEvent[]> {
    return this.events.createEvents(events);
  }

  async deleteEvents(
    ids: Array<{ external_id?: string; id?: number }>,
  ): Promise<void> {
    return this.events.deleteEvents(ids);
  }
}

export function createClient(
  options?: IntervalsClientOptions,
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
