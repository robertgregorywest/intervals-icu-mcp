import { describe, it, expect, vi } from "vitest";
import { HttpClient } from "../../src/client.js";
import { WellnessApi } from "../../src/services/wellness/wellness.js";

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

describe("WellnessApi", () => {
  it("GETs wellness data with date range", async () => {
    const records = [{ date: "2024-01-01", ctl: 60, atl: 70 }];
    const mockFetch = createMockFetch(200, records);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new WellnessApi(httpClient, config.athleteId);

    const result = await api.getWellness("2024-01-01", "2024-01-31");

    expect(result).toEqual(records);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://intervals.icu/api/v1/athlete/i12345/wellness?oldest=2024-01-01&newest=2024-01-31"
    );
  });

  it("GETs wellness for a single day", async () => {
    const record = { date: "2024-01-15", ctl: 62, atl: 65 };
    const mockFetch = createMockFetch(200, record);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new WellnessApi(httpClient, config.athleteId);

    const result = await api.getWellnessDay("2024-01-15");

    expect(result).toEqual(record);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://intervals.icu/api/v1/athlete/i12345/wellness/2024-01-15"
    );
  });
});
