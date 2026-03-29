import type { ClientConfig, RequestOptions } from "./types.js";

export interface IHttpClient {
  request<T>(endpoint: string, options?: RequestOptions): Promise<T>;
}

export type FetchFn = typeof globalThis.fetch;

const DEFAULT_BASE_URL = "https://intervals.icu";
const RATE_LIMIT_MS = 150;

export class HttpClient implements IHttpClient {
  private config: ClientConfig;
  private fetchFn: FetchFn;
  private lastRequestTime = 0;

  constructor(config: ClientConfig, fetchFn: FetchFn = globalThis.fetch) {
    this.config = config;
    this.fetchFn = fetchFn;
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    await this.enforceRateLimit();

    const url = `${this.config.baseUrl}${endpoint}`;
    const authHeader = `Basic ${btoa(`API_KEY:${this.config.apiKey}`)}`;

    const headers: Record<string, string> = {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    };

    const fetchOptions: RequestInit = {
      method: options.method || "GET",
      headers,
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await this.fetchFn(url, fetchOptions);
    this.lastRequestTime = Date.now();

    if (!response.ok) {
      const message = await this.getErrorMessage(response);
      throw new HttpError(response.status, message);
    }

    return this.parseResponse<T>(response);
  }

  private async enforceRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_MS - elapsed),
      );
    }
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json() as Promise<T>;
    }
    return response.text() as unknown as T;
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
  fetchFn?: FetchFn,
): HttpClient {
  const fullConfig: ClientConfig = {
    apiKey: config.apiKey,
    athleteId: config.athleteId || "0",
    baseUrl: config.baseUrl || DEFAULT_BASE_URL,
  };
  return new HttpClient(fullConfig, fetchFn);
}
