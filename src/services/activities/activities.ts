import type { IHttpClient } from "../../client.js";
import type { Activity, ActivityStreams } from "./types.js";

export interface IActivitiesApi {
  getActivities(oldest: string, newest: string): Promise<Activity[]>;
  getActivity(id: string, includeIntervals?: boolean): Promise<Activity>;
  getActivityStreams(id: string, types?: string[]): Promise<ActivityStreams>;
}

export class ActivitiesApi implements IActivitiesApi {
  private httpClient: IHttpClient;
  private athleteId: string;

  constructor(httpClient: IHttpClient, athleteId: string) {
    this.httpClient = httpClient;
    this.athleteId = athleteId;
  }

  async getActivities(oldest: string, newest: string): Promise<Activity[]> {
    return this.httpClient.request<Activity[]>(
      `/api/v1/athlete/${this.athleteId}/activities?oldest=${oldest}&newest=${newest}`
    );
  }

  async getActivity(id: string, includeIntervals = false): Promise<Activity> {
    const query = includeIntervals ? "?intervals=true" : "";
    return this.httpClient.request<Activity>(`/api/v1/activity/${id}${query}`);
  }

  async getActivityStreams(
    id: string,
    types?: string[]
  ): Promise<ActivityStreams> {
    const query = types?.length ? `?types=${types.join(",")}` : "";
    const raw = await this.httpClient.request<unknown>(
      `/api/v1/activity/${id}/streams.json${query}`
    );
    return normalizeStreams(raw);
  }
}

function normalizeStreams(raw: unknown): ActivityStreams {
  // Intervals.icu returns an array of { type, data } stream objects;
  // the rest of the codebase expects a keyed object ({ watts, heartrate, ... }).
  if (Array.isArray(raw)) {
    const out: Record<string, unknown> = {};
    for (const entry of raw) {
      if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as { type?: unknown }).type === "string"
      ) {
        const e = entry as { type: string; data?: unknown };
        out[e.type] = e.data;
      }
    }
    return out as ActivityStreams;
  }
  if (raw && typeof raw === "object") {
    return raw as ActivityStreams;
  }
  return {} as ActivityStreams;
}

export function createActivitiesApi(
  httpClient: IHttpClient,
  athleteId: string
): ActivitiesApi {
  return new ActivitiesApi(httpClient, athleteId);
}
