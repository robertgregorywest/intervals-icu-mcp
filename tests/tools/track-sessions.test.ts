import { describe, it, expect, vi } from "vitest";
import { fileURLToPath } from "node:url";
import {
  listTrackSessions,
  getTrackSession,
  compareTrackSessions,
  listTrackSessionsSchema,
  getTrackSessionSchema,
  compareTrackSessionsSchema,
  listTrackSessionsOutputSchema,
  getTrackSessionOutputSchema,
  compareTrackSessionsOutputSchema,
} from "../../src/tools/track-sessions.js";
import {
  createTrackSessions,
  loadTrackSessionRecords,
} from "../../src/services/track-sessions/index.js";
import type { IIntervalsClient } from "../../src/index.js";

const FIXTURES = fileURLToPath(
  new URL("../fixtures/track-sessions", import.meta.url)
);

/** The real service behind the client interface, reading the fixtures. */
function fixtureClient(): IIntervalsClient {
  const service = createTrackSessions({
    load: () => loadTrackSessionRecords(FIXTURES),
  });
  return {
    listTrackSessions: vi.fn(() => service.listTrackSessions()),
    getTrackSession: vi.fn((o) => service.getTrackSession(o)),
    compareTrackSessions: vi.fn((o) => service.compareTrackSessions(o)),
  } as unknown as IIntervalsClient;
}

describe("track session tool schemas", () => {
  it("takes no arguments to list", () => {
    expect(listTrackSessionsSchema.parse({})).toEqual({});
  });

  it("requires an id to get a session", () => {
    expect(getTrackSessionSchema.safeParse({}).success).toBe(false);
    expect(getTrackSessionSchema.safeParse({ id: "" }).success).toBe(false);
    expect(getTrackSessionSchema.parse({ id: "x", segmentLaps: 2 })).toEqual({
      id: "x",
      segmentLaps: 2,
    });
  });

  it("requires two runs to compare, because one is not a comparison", () => {
    expect(compareTrackSessionsSchema.safeParse({ runs: ["a"] }).success).toBe(
      false
    );
    expect(
      compareTrackSessionsSchema.safeParse({ runs: ["a", "b"] }).success
    ).toBe(true);
  });

  it("rejects a fractional segmentLaps", () => {
    expect(
      getTrackSessionSchema.safeParse({ id: "x", segmentLaps: 1.5 }).success
    ).toBe(false);
  });
});

describe("track session tool handlers", () => {
  it("lists sessions in a shape matching the declared output schema", async () => {
    const client = fixtureClient();
    const result = await listTrackSessions(client);
    expect(listTrackSessionsOutputSchema.parse(result)).toBeTruthy();
    expect(result.sessions).toHaveLength(4);
    expect(client.listTrackSessions).toHaveBeenCalled();
  });

  it("passes id and segmentLaps through, and matches the output schema", async () => {
    const client = fixtureClient();
    const result = await getTrackSession(client, {
      id: "2026-nationals-ip",
      segmentLaps: 2,
    });
    expect(getTrackSessionOutputSchema.parse(result)).toBeTruthy();
    expect(client.getTrackSession).toHaveBeenCalledWith({
      id: "2026-nationals-ip",
      segmentLaps: 2,
    });
    expect(result.runs[0].summary.opening).toMatchObject({
      fromLap: 2,
      toLap: 3,
    });
  });

  it("compares runs in a shape matching the declared output schema", async () => {
    const client = fixtureClient();
    const result = await compareTrackSessions(client, {
      runs: ["2026-09-06-bmrc-ip", "2026-nationals-ip"],
    });
    expect(compareTrackSessionsOutputSchema.parse(result)).toBeTruthy();
    expect(result.summary.map((r) => r.label)).toEqual([
      "Total",
      "Flying",
      "Opening",
      "Closing",
      "Decline",
    ]);
  });
});
