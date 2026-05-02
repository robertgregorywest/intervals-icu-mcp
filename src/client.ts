import type { ClientConfig, RequestOptions } from "./types.js";

export interface IHttpClient {
  request<T>(endpoint: string, options?: RequestOptions): Promise<T>;
}

export type FetchFn = typeof globalThis.fetch;

const DEFAULT_BASE_URL = "https://intervals.icu";
const RATE_LIMIT_MS = 150;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

export class HttpClient implements IHttpClient {
  private config: ClientConfig;
  private fetchFn: FetchFn;
  private lastRequestTime = 0;

  constructor(config: ClientConfig, fetchFn: FetchFn = globalThis.fetch) {
    this.config = config;
    this.fetchFn = fetchFn;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const method = options.method || "GET";
    const authHeader = `Basic ${btoa(`API_KEY:${this.config.apiKey}`)}`;
    const headers: Record<string, string> = {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    };
    const body = options.body ? JSON.stringify(options.body) : undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await this.enforceRateLimit();

      let response: Response;
      try {
        response = await this.fetchFn(url, {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        this.lastRequestTime = Date.now();
        if (attempt < MAX_ATTEMPTS && shouldRetryError(error, method)) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw normalizeFetchError(error);
      }

      this.lastRequestTime = Date.now();

      if (response.ok) {
        return this.parseResponse<T>(response);
      }

      if (
        attempt < MAX_ATTEMPTS &&
        shouldRetryStatus(response.status, method)
      ) {
        const delay = retryDelayFromHeader(response) ?? backoffMs(attempt);
        // Drain so the connection can be reused
        await response.text().catch(() => undefined);
        await sleep(delay);
        continue;
      }

      const message = await this.getErrorMessage(response);
      throw new HttpError(response.status, message);
    }

    throw new HttpError(0, "Exceeded maximum retry attempts");
  }

  private async enforceRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await sleep(RATE_LIMIT_MS - elapsed);
    }
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    if (
      response.status === 204 ||
      response.headers.get("content-length") === "0"
    ) {
      return undefined as T;
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    const text = await response.text();
    if (!text) return undefined as T;
    // Some Intervals.icu endpoints return JSON with text/plain. Try to parse,
    // fall through to raw text only when parsing fails.
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  private async getErrorMessage(response: Response): Promise<string> {
    try {
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };
      return data.message || data.error || response.statusText;
    } catch {
      return response.statusText;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const exp = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  const jitter = Math.random() * exp * 0.25;
  return Math.round(exp + jitter);
}

function retryDelayFromHeader(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

function shouldRetryStatus(status: number, method: string): boolean {
  // 429 means the request was rejected before processing — safe to retry any method.
  if (status === 429) return true;
  // 5xx may have processed — only retry idempotent methods to avoid duplicate writes.
  if (status >= 500 && method === "GET") return true;
  return false;
}

function shouldRetryError(error: unknown, method: string): boolean {
  // Network/timeout errors on non-GET may have reached the server — don't retry.
  if (method !== "GET") return false;
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error.name === "TypeError" // node fetch wraps connection errors as TypeError
  );
}

function normalizeFetchError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return new HttpError(
        0,
        `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
      );
    }
    return error;
  }
  return new Error(String(error));
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export function createHttpClient(
  config: Partial<ClientConfig> & { apiKey: string },
  fetchFn?: FetchFn
): HttpClient {
  const fullConfig: ClientConfig = {
    apiKey: config.apiKey,
    athleteId: config.athleteId || "0",
    baseUrl: config.baseUrl || DEFAULT_BASE_URL,
  };
  return new HttpClient(fullConfig, fetchFn);
}
