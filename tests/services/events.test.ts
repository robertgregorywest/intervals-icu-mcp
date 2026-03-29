import { describe, it, expect, vi } from "vitest";
import { HttpClient, HttpError } from "../../src/client.js";
import { EventsApi } from "../../src/services/events/events.js";
import type { IntervalsEvent } from "../../src/types.js";

function createMockFetch(
  status: number,
  body: unknown,
  contentType = "application/json",
) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({ "content-type": contentType }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

const config = {
  apiKey: "test-api-key",
  athleteId: "i12345",
  baseUrl: "https://intervals.icu",
};

describe("EventsApi", () => {
  describe("createEvents", () => {
    it("POSTs events to the bulk endpoint with upsert", async () => {
      const responseEvents = [{ id: 1, name: "Test Workout" }];
      const mockFetch = createMockFetch(200, responseEvents);
      const httpClient = new HttpClient(config, mockFetch);
      const eventsApi = new EventsApi(httpClient, config.athleteId);

      const events: IntervalsEvent[] = [
        {
          category: "WORKOUT",
          start_date_local: "2024-03-30T00:00:00",
          type: "Ride",
          name: "Test Workout",
          description: "- 10m 60%",
          external_id: "test-1",
        },
      ];

      await eventsApi.createEvents(events);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        "https://intervals.icu/api/v1/athlete/i12345/events/bulk?upsert=true",
      );
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body as string)).toEqual(events);
    });

    it("sends correct Basic auth header", async () => {
      const mockFetch = createMockFetch(200, []);
      const httpClient = new HttpClient(config, mockFetch);
      const eventsApi = new EventsApi(httpClient, config.athleteId);

      await eventsApi.createEvents([]);

      const [, options] = mockFetch.mock.calls[0];
      const expectedAuth = `Basic ${btoa("API_KEY:test-api-key")}`;
      expect(options.headers.Authorization).toBe(expectedAuth);
    });

    it("throws HttpError on failure", async () => {
      const mockFetch = createMockFetch(401, {
        message: "Unauthorized",
      });
      const httpClient = new HttpClient(config, mockFetch);
      const eventsApi = new EventsApi(httpClient, config.athleteId);

      await expect(eventsApi.createEvents([])).rejects.toThrow(HttpError);
      await expect(eventsApi.createEvents([])).rejects.toThrow("Unauthorized");
    });
  });

  describe("deleteEvents", () => {
    it("PUTs delete request to bulk-delete endpoint", async () => {
      const mockFetch = createMockFetch(200, undefined);
      const httpClient = new HttpClient(config, mockFetch);
      const eventsApi = new EventsApi(httpClient, config.athleteId);

      const ids = [{ external_id: "test-1" }, { id: 12345 }];
      await eventsApi.deleteEvents(ids);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        "https://intervals.icu/api/v1/athlete/i12345/events/bulk-delete",
      );
      expect(options.method).toBe("PUT");
      expect(JSON.parse(options.body as string)).toEqual(ids);
    });
  });
});
