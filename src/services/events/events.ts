import type { IHttpClient } from "../../client.js";
import type { IntervalsEvent } from "../../types.js";

export interface IEventsApi {
  createEvents(events: IntervalsEvent[]): Promise<IntervalsEvent[]>;
  deleteEvents(
    ids: Array<{ external_id?: string; id?: number }>,
  ): Promise<void>;
}

export class EventsApi implements IEventsApi {
  private httpClient: IHttpClient;
  private athleteId: string;

  constructor(httpClient: IHttpClient, athleteId: string) {
    this.httpClient = httpClient;
    this.athleteId = athleteId;
  }

  async createEvents(events: IntervalsEvent[]): Promise<IntervalsEvent[]> {
    return this.httpClient.request<IntervalsEvent[]>(
      `/api/v1/athlete/${this.athleteId}/events/bulk?upsert=true`,
      {
        method: "POST",
        body: events,
      },
    );
  }

  async deleteEvents(
    ids: Array<{ external_id?: string; id?: number }>,
  ): Promise<void> {
    await this.httpClient.request<void>(
      `/api/v1/athlete/${this.athleteId}/events/bulk-delete`,
      {
        method: "PUT",
        body: ids,
      },
    );
  }
}

export function createEventsApi(
  httpClient: IHttpClient,
  athleteId: string,
): EventsApi {
  return new EventsApi(httpClient, athleteId);
}
