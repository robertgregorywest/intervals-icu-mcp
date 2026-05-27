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
    const activities = [{ id: "i1", name: "Morning Ride" }];
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
    const activity = { id: "i42", name: "Ride" };
    const mockFetch = createMockFetch(200, activity);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    await api.getActivity("i42");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/activity/i42");
  });

  it("GETs single activity with intervals", async () => {
    const mockFetch = createMockFetch(200, { id: "i42" });
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    await api.getActivity("i42", true);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://intervals.icu/api/v1/activity/i42?intervals=true"
    );
  });

  it("GETs activity streams with type filter", async () => {
    const streams = { watts: [200, 210], heartrate: [130, 135] };
    const mockFetch = createMockFetch(200, streams);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    const result = await api.getActivityStreams("i42", ["watts", "heartrate"]);

    expect(result).toEqual(streams);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://intervals.icu/api/v1/activity/i42/streams.json?types=watts,heartrate"
    );
  });

  it("GETs activity streams without type filter", async () => {
    const mockFetch = createMockFetch(200, {});
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    await api.getActivityStreams("i42");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/activity/i42/streams.json");
  });

  it("normalises array-shaped streams response into a keyed object", async () => {
    const arrayResponse = [
      { type: "watts", name: null, data: [200, 210, 220] },
      { type: "heartrate", name: null, data: [130, 135, 140] },
    ];
    const mockFetch = createMockFetch(200, arrayResponse);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    const result = await api.getActivityStreams("i42", ["watts", "heartrate"]);

    expect(result.watts).toEqual([200, 210, 220]);
    expect(result.heartrate).toEqual([130, 135, 140]);
  });

  it("passes through already-keyed streams response unchanged", async () => {
    const keyed = { watts: [200, 210], heartrate: [130, 135] };
    const mockFetch = createMockFetch(200, keyed);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new ActivitiesApi(httpClient, config.athleteId);

    const result = await api.getActivityStreams("i42", ["watts", "heartrate"]);

    expect(result).toEqual(keyed);
  });
});
