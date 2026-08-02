import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HttpClient } from "../../../src/client.js";
import { ActivitiesApi } from "../../../src/services/activities/activities.js";
import { EventsApi } from "../../../src/services/events/events.js";
import { SessionReview } from "../../../src/services/session-review/session-review.js";

function fixture(name: string) {
  const path = fileURLToPath(
    new URL(`../../fixtures/session-review/${name}.json`, import.meta.url)
  );
  return JSON.parse(readFileSync(path, "utf8"));
}

const config = {
  apiKey: "test-api-key",
  athleteId: "i12345",
  baseUrl: "https://intervals.icu",
};

/**
 * Route requests by URL so a test can describe the whole Intervals.icu surface
 * a comparison touches, and assert on exactly which calls were made.
 */
function routedFetch(routes: Array<[RegExp, unknown]>) {
  return vi.fn(async (url: string) => {
    for (const [pattern, body] of routes) {
      if (pattern.test(url)) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(body),
          text: () => Promise.resolve(JSON.stringify(body)),
        } as unknown as Response;
      }
    }
    throw new Error(`unexpected request: ${url}`);
  });
}

function build(fetchFn: ReturnType<typeof routedFetch>) {
  const httpClient = new HttpClient(config, fetchFn as never);
  return new SessionReview({
    activitiesApi: new ActivitiesApi(httpClient, config.athleteId),
    eventsApi: new EventsApi(httpClient, config.athleteId),
  });
}

describe("SessionReview — argument handling", () => {
  it("rejects both identifiers together", async () => {
    const review = build(routedFetch([]));
    await expect(
      review.comparePlannedVsActual({ activityId: "i1", eventId: 2 })
    ).rejects.toThrow(/exactly one/);
  });

  it("rejects neither identifier", async () => {
    const review = build(routedFetch([]));
    await expect(review.comparePlannedVsActual({})).rejects.toThrow(
      /exactly one/
    );
  });
});

describe("SessionReview — activity entry", () => {
  it("resolves the event from paired_event_id and compares", async () => {
    const { activity, event } = fixture("sweet-spot-3x12");
    const fetchFn = routedFetch([
      [/\/activity\//, activity],
      [/\/events\//, event],
    ]);
    const review = build(fetchFn);

    const result = await review.comparePlannedVsActual({
      activityId: activity.id,
    });

    expect(result.eventId).toBe(event.id);
    expect(result.activityId).toBe(activity.id);
    expect(result.alignmentBasis).toBe("sequential");
    expect(result.steps).toHaveLength(8);
    expect(result.tolerance).toBe(0.05);

    // The event was resolved from the activity, not guessed from the date.
    const urls = fetchFn.mock.calls.map(([u]) => u as string);
    expect(urls.some((u) => u.includes(`/events/${event.id}`))).toBe(true);
    expect(urls.some((u) => u.includes("oldest="))).toBe(false);
  });

  it("passes a caller-supplied tolerance through and echoes it", async () => {
    const { activity, event } = fixture("sweet-spot-3x12");
    const review = build(
      routedFetch([
        [/\/activity\//, activity],
        [/\/events\//, event],
      ])
    );

    const result = await review.comparePlannedVsActual({
      activityId: activity.id,
      tolerance: 0.15,
    });

    expect(result.tolerance).toBe(0.15);
  });
});

describe("SessionReview — event entry", () => {
  it("finds the activity that points back at the event", async () => {
    const { activity, event } = fixture("sweet-spot-3x12");
    // The list payload carries paired_event_id but no intervals.
    const listed = [
      { ...activity, icu_intervals: [] },
      { id: "i999", paired_event_id: 999999 },
    ];
    const fetchFn = routedFetch([
      [/\/activities\?/, listed],
      [/\/activity\//, activity],
      [/\/events\//, event],
    ]);
    const review = build(fetchFn);

    const result = await review.comparePlannedVsActual({ eventId: event.id });

    expect(result.activityId).toBe(activity.id);
    expect(result.alignmentBasis).toBe("sequential");

    // The window is bounded and centred on the event's date.
    const listUrl = fetchFn.mock.calls
      .map(([u]) => u as string)
      .find((u) => u.includes("oldest="))!;
    expect(listUrl).toContain("oldest=2026-07-27");
    expect(listUrl).toContain("newest=2026-07-31");
  });

  it("reports no-paired-activity when nothing in the window points back", async () => {
    const { event } = fixture("sweet-spot-3x12");
    const review = build(
      routedFetch([
        [/\/activities\?/, [{ id: "i999", paired_event_id: 424242 }]],
        [/\/events\//, event],
      ])
    );

    const result = await review.comparePlannedVsActual({ eventId: event.id });

    expect(result.reason).toBe("no-paired-activity");
    expect(result.alignmentBasis).toBe("none");
    expect(result.steps).toEqual([]);
    expect(result.message).toMatch(/not executed, or has not been uploaded/);
    // The planned half is still described.
    expect(result.rollup.plannedLoad).toBe(75);
  });
});

describe("SessionReview — refusal paths", () => {
  it("reports no-paired-event for an unpaired activity", async () => {
    const { activity } = fixture("sweet-spot-3x12");
    const review = build(
      routedFetch([[/\/activity\//, { ...activity, paired_event_id: null }]])
    );

    const result = await review.comparePlannedVsActual({
      activityId: activity.id,
    });

    expect(result.reason).toBe("no-paired-event");
    expect(result.steps).toEqual([]);
    expect(result.rollup.actualLoad).toBe(72);
  });

  it("reports no-structured-steps when the event has no workout_doc", async () => {
    const { activity, event } = fixture("no-structured-steps");
    const review = build(
      routedFetch([
        [/\/activity\//, activity],
        [/\/events\//, event],
      ])
    );

    const result = await review.comparePlannedVsActual({
      activityId: activity.id,
    });

    expect(result.reason).toBe("no-structured-steps");
    expect(result.steps).toEqual([]);
    expect(result.message).toMatch(/no structured workout steps/);
  });

  it("reports no-intervals rather than falling back to activity averages", async () => {
    const { activity, event } = fixture("no-intervals");
    const review = build(
      routedFetch([
        [/\/activity\//, activity],
        [/\/events\//, event],
      ])
    );

    const result = await review.comparePlannedVsActual({
      activityId: activity.id,
    });

    expect(result.reason).toBe("no-intervals");
    expect(result.steps).toEqual([]);
    expect(result.message).toMatch(/not a substitute/);
    // Roll-up still answers the coarse question.
    expect(result.rollup.plannedLoad).toBe(35);
    expect(result.rollup.actualLoad).toBe(44);
    expect(result.rollup.platformCompliance).toBe(61.5);
  });

  it("reports alignment-failed on the real 9-step / 3-lap session", async () => {
    const { activity, event } = fixture("track-session");
    const review = build(
      routedFetch([
        [/\/activity\//, activity],
        [/\/events\//, event],
      ])
    );

    const result = await review.comparePlannedVsActual({
      activityId: activity.id,
    });

    expect(result.reason).toBe("alignment-failed");
    expect(result.alignmentBasis).toBe("none");
    expect(result.steps).toEqual([]);
    expect(result.rollup.plannedLoad).toBe(73);
    expect(result.rollup.actualLoad).toBe(54);
  });
});

describe("SessionReview — read-only", () => {
  it("issues only GET requests on every path", async () => {
    const fixtures = [
      "sweet-spot-3x12",
      "track-session",
      "no-intervals",
      "no-structured-steps",
    ];

    for (const name of fixtures) {
      const { activity, event } = fixture(name);
      const fetchFn = routedFetch([
        [/\/activity\//, activity],
        [/\/events\//, event],
      ]);
      const review = build(fetchFn);

      await review.comparePlannedVsActual({ activityId: activity.id });

      for (const [, init] of fetchFn.mock.calls) {
        const method = (init as RequestInit | undefined)?.method ?? "GET";
        expect(method).toBe("GET");
      }
    }
  });
});
