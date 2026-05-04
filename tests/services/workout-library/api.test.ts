import { describe, it, expect, vi } from "vitest";
import { HttpClient } from "../../../src/client.js";
import { WorkoutLibraryApi } from "../../../src/services/workout-library/api.js";

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

describe("WorkoutLibraryApi", () => {
  it("GETs folders", async () => {
    const folders = [{ id: 1, name: "Coach Templates", workouts: [] }];
    const mockFetch = createMockFetch(200, folders);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new WorkoutLibraryApi(httpClient, config.athleteId);

    const result = await api.listFolders();

    expect(result).toEqual(folders);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/athlete/i12345/folders");
  });

  it("GETs a single workout", async () => {
    const workout = { id: 42, name: "VO2 4x4", description: "- 4m 110%" };
    const mockFetch = createMockFetch(200, workout);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new WorkoutLibraryApi(httpClient, config.athleteId);

    const result = await api.getWorkout(42);

    expect(result).toEqual(workout);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/athlete/i12345/workouts/42");
  });

  it("POSTs a new folder", async () => {
    const created = { id: 7, name: "VO2 Max", parent: 1 };
    const mockFetch = createMockFetch(200, created);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new WorkoutLibraryApi(httpClient, config.athleteId);

    await api.createFolder("VO2 Max", 1);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/athlete/i12345/folders");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "VO2 Max",
      parent: 1,
    });
  });

  it("POSTs a new workout", async () => {
    const created = {
      id: 99,
      name: "Sweet Spot 3x12",
      description: "- 12m 90%",
    };
    const mockFetch = createMockFetch(200, created);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new WorkoutLibraryApi(httpClient, config.athleteId);

    await api.createWorkout({
      name: "Sweet Spot 3x12",
      description: "- 12m 90%",
      folder_id: 7,
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/athlete/i12345/workouts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Sweet Spot 3x12",
      description: "- 12m 90%",
      folder_id: 7,
    });
  });

  it("PUTs a workout update", async () => {
    const updated = { id: 99, name: "Sweet Spot 3x12", description: "new" };
    const mockFetch = createMockFetch(200, updated);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new WorkoutLibraryApi(httpClient, config.athleteId);

    await api.updateWorkout(99, { description: "new" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/athlete/i12345/workouts/99");
    expect(init.method).toBe("PUT");
  });
});
