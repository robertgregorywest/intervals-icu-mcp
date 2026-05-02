import { describe, it, expect, vi } from "vitest";
import { HttpClient, HttpError } from "../src/client.js";

const config = {
  apiKey: "test-key",
  athleteId: "i12345",
  baseUrl: "https://intervals.icu",
};

function mockResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  const allHeaders = new Headers({
    "content-type": "application/json",
    ...headers,
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: statusText(status),
    headers: allHeaders,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function statusText(s: number): string {
  if (s === 429) return "Too Many Requests";
  if (s === 503) return "Service Unavailable";
  if (s === 404) return "Not Found";
  return s >= 200 && s < 300 ? "OK" : "Error";
}

describe("HttpClient retries", () => {
  it("retries 5xx on GET and succeeds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(503, { error: "down" }))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));
    const client = new HttpClient(config, fetchFn);

    const result = await client.request<{ ok: boolean }>("/x");

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry 5xx on POST", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(mockResponse(503, { error: "down" }));
    const client = new HttpClient(config, fetchFn);

    await expect(
      client.request("/x", { method: "POST", body: { a: 1 } })
    ).rejects.toMatchObject({ name: "HttpError", status: 503 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries 429 on POST (rate limit didn't process the request)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(429, { error: "slow" }))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));
    const client = new HttpClient(config, fetchFn);

    const result = await client.request("/x", { method: "POST", body: {} });

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry 4xx (other than 429)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(mockResponse(404, { message: "missing" }));
    const client = new HttpClient(config, fetchFn);

    await expect(client.request("/x")).rejects.toMatchObject({
      name: "HttpError",
      status: 404,
      message: "missing",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("gives up after MAX_ATTEMPTS retries", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(mockResponse(503, { error: "down" }));
    const client = new HttpClient(config, fetchFn);

    await expect(client.request("/x")).rejects.toMatchObject({
      name: "HttpError",
      status: 503,
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  }, 15_000);

  it("honors Retry-After header (seconds form)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(429, { error: "slow" }, { "retry-after": "0" })
      )
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));
    const client = new HttpClient(config, fetchFn);

    await client.request("/x");

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe("HttpClient parseResponse", () => {
  it("returns undefined for 204 No Content", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
      headers: new Headers({ "content-length": "0" }),
      json: () => Promise.reject(new Error("no body")),
      text: () => Promise.resolve(""),
    });
    const client = new HttpClient(config, fetchFn);

    const result = await client.request("/x", { method: "DELETE" });
    expect(result).toBeUndefined();
  });

  it("falls back to JSON parse when content-type is text but body is JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "text/plain" }),
      json: () => Promise.reject(new Error("wrong path")),
      text: () => Promise.resolve('{"value":42}'),
    });
    const client = new HttpClient(config, fetchFn);

    const result = await client.request<{ value: number }>("/x");
    expect(result).toEqual({ value: 42 });
  });

  it("returns raw text when body is not parseable JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "text/plain" }),
      json: () => Promise.reject(new Error("not used")),
      text: () => Promise.resolve("hello"),
    });
    const client = new HttpClient(config, fetchFn);

    const result = await client.request<string>("/x");
    expect(result).toBe("hello");
  });
});

describe("HttpClient timeout", () => {
  it("normalizes AbortError to a 0-status HttpError", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    // Non-GET so we don't trigger a retry
    const fetchFn = vi.fn().mockRejectedValue(abortError);
    const client = new HttpClient(config, fetchFn);

    await expect(
      client.request("/x", { method: "POST", body: {} })
    ).rejects.toBeInstanceOf(HttpError);
  });
});
