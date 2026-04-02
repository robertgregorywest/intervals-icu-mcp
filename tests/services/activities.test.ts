import { describe, it, expect, vi } from "vitest";
import { HttpClient } from "../../src/client.js";
import { ActivitiesApi } from "../../src/services/activities/activities.js";

function createMockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

const config = {
  apiKey: "test-api-key",
  athleteId: "i12345",
  baseUrl: "https://intervals.icu",
};

describe("ActivitiesApi", () => {
  it("GETs activities with date range", async () => {
    const activities = [{ id: 1, name: "Morning Ride" }];
    const mockFetch = createMockFetch(200, activities);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    const result = await api.getActivities("2024-01-01", "2024-01-31");

    expect(result).toEqual(activities);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://intervals.icu/api/v1/athlete/i12345/activities?oldest=2024-01-01&newest=2024-01-31"
    );
  });

  it("GETs single activity without intervals", async () => {
    const activity = { id: 42, name: "Ride" };
    const mockFetch = createMockFetch(200, activity);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    await api.getActivity(42);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/activity/42");
  });

  it("GETs single activity with intervals", async () => {
    const mockFetch = createMockFetch(200, { id: 42 });
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    await api.getActivity(42, true);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/activity/42?intervals=true");
  });

  it("GETs activity streams with type filter", async () => {
    const streams = { watts: [200, 210], heartrate: [130, 135] };
    const mockFetch = createMockFetch(200, streams);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    const result = await api.getActivityStreams(42, ["watts", "heartrate"]);

    expect(result).toEqual(streams);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://intervals.icu/api/v1/activity/42/streams.json?types=watts,heartrate"
    );
  });

  it("GETs activity streams without type filter", async () => {
    const mockFetch = createMockFetch(200, {});
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    await api.getActivityStreams(42);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/activity/42/streams.json");
  });
});
