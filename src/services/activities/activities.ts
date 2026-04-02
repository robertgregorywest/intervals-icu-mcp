import type { IHttpClient } from "../../client.js";
import type { Activity, ActivityStreams } from "./types.js";

export interface IActivitiesApi {
  getActivities(oldest: string, newest: string): Promise<Activity[]>;
  getActivity(id: number, includeIntervals?: boolean): Promise<Activity>;
  getActivityStreams(id: number, types?: string[]): Promise<ActivityStreams>;
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

  async getActivity(id: number, includeIntervals = false): Promise<Activity> {
    const query = includeIntervals ? "?intervals=true" : "";
    return this.httpClient.request<Activity>(`/api/v1/activity/${id}${query}`);
  }

  async getActivityStreams(
    id: number,
    types?: string[]
  ): Promise<ActivityStreams> {
    const query = types?.length ? `?types=${types.join(",")}` : "";
    return this.httpClient.request<ActivityStreams>(
      `/api/v1/activity/${id}/streams.json${query}`
    );
  }
}

export function createActivitiesApi(
  httpClient: IHttpClient,
  athleteId: string
): ActivitiesApi {
  return new ActivitiesApi(httpClient, athleteId);
}
