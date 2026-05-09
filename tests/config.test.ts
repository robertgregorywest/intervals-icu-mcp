import { describe, it, expect } from "vitest";
import { parseClientConfig } from "../src/config.js";

describe("parseClientConfig", () => {
  const valid = {
    apiKey: "abc123",
    athleteId: "i12345",
    baseUrl: "https://intervals.icu",
  };

  it("returns the validated config when input is valid", () => {
    expect(parseClientConfig(valid)).toEqual(valid);
  });

  it("accepts athleteId '0' (default for authenticated user)", () => {
    expect(parseClientConfig({ ...valid, athleteId: "0" }).athleteId).toBe("0");
  });

  it("accepts an http baseUrl, not just https", () => {
    const out = parseClientConfig({
      ...valid,
      baseUrl: "http://localhost:8080",
    });
    expect(out.baseUrl).toBe("http://localhost:8080");
  });

  it("rejects a missing apiKey", () => {
    expect(() => parseClientConfig({ ...valid, apiKey: undefined })).toThrow(
      /API key required/
    );
  });

  it("rejects an empty / whitespace-only apiKey", () => {
    expect(() => parseClientConfig({ ...valid, apiKey: "" })).toThrow(
      /API key required/
    );
    expect(() => parseClientConfig({ ...valid, apiKey: "   " })).toThrow(
      /API key required/
    );
  });

  it("rejects an athleteId with non-alphanumeric characters", () => {
    expect(() => parseClientConfig({ ...valid, athleteId: "i-123" })).toThrow(
      /alphanumeric/
    );
    expect(() =>
      parseClientConfig({ ...valid, athleteId: "user@example" })
    ).toThrow(/alphanumeric/);
  });

  it("rejects a missing athleteId", () => {
    expect(() => parseClientConfig({ ...valid, athleteId: undefined })).toThrow(
      /alphanumeric/
    );
  });

  it("rejects a baseUrl with a non-http(s) protocol", () => {
    expect(() =>
      parseClientConfig({ ...valid, baseUrl: "ftp://intervals.icu" })
    ).toThrow(/Invalid base URL.*http or https/);
  });

  it("rejects a malformed baseUrl", () => {
    expect(() => parseClientConfig({ ...valid, baseUrl: "not a url" })).toThrow(
      /Invalid base URL/
    );
  });

  it("rejects a missing baseUrl", () => {
    expect(() => parseClientConfig({ ...valid, baseUrl: undefined })).toThrow(
      /baseUrl is required/
    );
  });
});
