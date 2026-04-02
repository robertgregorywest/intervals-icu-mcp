import { describe, it, expect, vi } from "vitest";
import { HttpClient } from "../../src/client.js";
import { AthleteApi } from "../../src/services/athlete/athlete.js";

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

describe("AthleteApi", () => {
  it("GETs athlete profile", async () => {
    const profile = { id: "i12345", name: "Test Athlete", ftp: 280 };
    const mockFetch = createMockFetch(200, profile);
    const httpClient = new HttpClient(config, mockFetch);
    const api = new AthleteApi(httpClient, config.athleteId);

    const result = await api.getAthlete();

    expect(result).toEqual(profile);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://intervals.icu/api/v1/athlete/i12345");
    expect(options.method).toBe("GET");
  });
});
