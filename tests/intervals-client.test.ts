import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { IntervalsClient } from "../src/index.js";

describe("IntervalsClient config validation", () => {
  const original = {
    INTERVALS_API_KEY: process.env.INTERVALS_API_KEY,
    INTERVALS_ATHLETE_ID: process.env.INTERVALS_ATHLETE_ID,
  };

  beforeEach(() => {
    delete process.env.INTERVALS_API_KEY;
    delete process.env.INTERVALS_ATHLETE_ID;
  });

  afterEach(() => {
    if (original.INTERVALS_API_KEY !== undefined)
      process.env.INTERVALS_API_KEY = original.INTERVALS_API_KEY;
    if (original.INTERVALS_ATHLETE_ID !== undefined)
      process.env.INTERVALS_ATHLETE_ID = original.INTERVALS_ATHLETE_ID;
  });

  it("rejects missing apiKey", () => {
    expect(() => new IntervalsClient()).toThrow(/API key required/);
  });

  it("rejects whitespace-only apiKey", () => {
    expect(() => new IntervalsClient({ apiKey: "   " })).toThrow(
      /API key required/
    );
  });

  it("rejects athleteId with non-alphanumeric characters", () => {
    expect(
      () => new IntervalsClient({ apiKey: "k", athleteId: "../etc/passwd" })
    ).toThrow(/Invalid athlete ID/);
  });

  it("rejects athleteId with whitespace", () => {
    expect(
      () => new IntervalsClient({ apiKey: "k", athleteId: "i 123" })
    ).toThrow(/Invalid athlete ID/);
  });

  it("rejects unparseable baseUrl", () => {
    expect(
      () => new IntervalsClient({ apiKey: "k", baseUrl: "not a url" })
    ).toThrow(/Invalid base URL/);
  });

  it("rejects non-http(s) baseUrl protocol", () => {
    expect(
      () => new IntervalsClient({ apiKey: "k", baseUrl: "file:///etc/hosts" })
    ).toThrow(/Invalid base URL/);
  });

  it("accepts valid config with default athleteId", () => {
    expect(() => new IntervalsClient({ apiKey: "k" })).not.toThrow();
  });

  it('accepts athleteId "0"', () => {
    expect(
      () => new IntervalsClient({ apiKey: "k", athleteId: "0" })
    ).not.toThrow();
  });

  it('accepts athleteId "i12345"', () => {
    expect(
      () => new IntervalsClient({ apiKey: "k", athleteId: "i12345" })
    ).not.toThrow();
  });
});
