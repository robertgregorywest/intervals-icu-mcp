import type { ClientConfig } from "./types.js";

export interface ClientConfigInput {
  apiKey?: string;
  athleteId?: string;
  baseUrl?: string;
}

export function parseClientConfig(input: ClientConfigInput): ClientConfig {
  const { apiKey, athleteId, baseUrl } = input;

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      "Intervals.icu API key required. " +
        "Provide apiKey in options or set INTERVALS_API_KEY env var."
    );
  }

  if (!athleteId || !/^[a-zA-Z0-9]+$/.test(athleteId)) {
    throw new Error(
      `Invalid athlete ID — must be alphanumeric (e.g. "0" or "i12345"), ` +
        `got ${JSON.stringify(athleteId)}.`
    );
  }

  if (!baseUrl) {
    throw new Error("baseUrl is required.");
  }
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("must use http or https");
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid base URL ${JSON.stringify(baseUrl)}: ${reason}`);
  }

  return { apiKey, athleteId, baseUrl };
}
