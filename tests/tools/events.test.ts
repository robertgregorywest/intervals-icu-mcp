import { describe, it, expect, vi } from "vitest";
import {
  getEvents,
  getEvent,
  updateEvent,
  deleteEvents,
} from "../../src/tools/events.js";
import type { IIntervalsClient } from "../../src/index.js";

function createMockClient(
  overrides: Partial<IIntervalsClient> = {}
): IIntervalsClient {
  return {
    getEvents: vi
      .fn()
      .mockResolvedValue([
        { id: 1, name: "Threshold Intervals", category: "WORKOUT" },
      ]),
    getEvent: vi.fn().mockResolvedValue({
      id: 1,
      name: "Threshold Intervals",
      category: "NOTE",
      description: "- 10m 60%",
    }),
    updateEvent: vi.fn().mockResolvedValue({
      id: 1,
      name: "Updated Workout",
    }),
    deleteEvents: vi.fn().mockResolvedValue(undefined),
    buildWorkoutDescription: vi
      .fn()
      .mockReturnValue("- Warmup 10m 150w\n\n- Main 5m 240w"),
    ...overrides,
  } as unknown as IIntervalsClient;
}

describe("getEvents tool handler", () => {
  it("returns events as JSON", async () => {
    const client = createMockClient();
    const result = await getEvents(client, {
      oldest: "2024-01-01",
      newest: "2024-01-31",
    });
    const parsed = result;

    expect(parsed.total).toBe(1);
    expect(parsed.count).toBe(1);
    expect(parsed.truncated).toBe(false);
    expect(parsed.events[0].name).toBe("Threshold Intervals");
    expect(client.getEvents).toHaveBeenCalledWith("2024-01-01", "2024-01-31");
  });
});

describe("getEvent tool handler", () => {
  it("returns single event as JSON", async () => {
    const client = createMockClient();
    const result = await getEvent(client, { id: 1 });
    const parsed = result;

    expect(parsed.description).toBe("- 10m 60%");
    expect(client.getEvent).toHaveBeenCalledWith(1);
  });
});

describe("updateEvent tool handler", () => {
  it("updates event and returns result", async () => {
    const client = createMockClient();
    const result = await updateEvent(client, {
      id: 1,
      name: "Updated Workout",
    });
    const parsed = result;

    expect(parsed.name).toBe("Updated Workout");
    expect(client.updateEvent).toHaveBeenCalledWith(1, {
      name: "Updated Workout",
    });
  });

  it("converts date to start_date_local", async () => {
    const client = createMockClient();
    await updateEvent(client, { id: 1, date: "2024-02-15" });

    expect(client.updateEvent).toHaveBeenCalledWith(1, {
      start_date_local: "2024-02-15T00:00:00",
    });
  });

  it("rebuilds description from steps and PUTs (issue #1)", async () => {
    const client = createMockClient();
    await updateEvent(client, {
      id: 1,
      name: "Long Z2 2.5h",
      steps: [
        { label: "Warmup", duration: "10m", target: "150w" },
        { label: "Main", duration: "5m", target: "240w" },
      ],
    });

    expect(client.buildWorkoutDescription).toHaveBeenCalledWith([
      { label: "Warmup", duration: "10m", target: "150w" },
      { label: "Main", duration: "5m", target: "240w" },
    ]);
    expect(client.updateEvent).toHaveBeenCalledWith(1, {
      name: "Long Z2 2.5h",
      description: "- Warmup 10m 150w\n\n- Main 5m 240w",
    });
    // safety: did not need to fetch the existing event
    expect(client.getEvent).not.toHaveBeenCalled();
  });

  it("rejects when both steps and description are provided", async () => {
    const client = createMockClient();
    await expect(
      updateEvent(client, {
        id: 1,
        steps: [{ duration: "10m", target: "150w" }],
        description: "some prose",
      })
    ).rejects.toThrow(/mutually exclusive/i);
    expect(client.updateEvent).not.toHaveBeenCalled();
  });

  it("rejects description-only update on a WORKOUT event (issue #1 guard)", async () => {
    const client = createMockClient({
      getEvent: vi.fn().mockResolvedValue({
        id: 1,
        category: "WORKOUT",
        name: "Original",
        description: "- 10m 60%",
      }),
    });
    await expect(
      updateEvent(client, {
        id: 1,
        name: "Renamed",
        description: "- some notes",
      })
    ).rejects.toThrow(/refusing to update 'description' on a WORKOUT event/);
    expect(client.updateEvent).not.toHaveBeenCalled();
  });

  it("allows description-only update on a non-WORKOUT event (NOTE)", async () => {
    const client = createMockClient({
      getEvent: vi.fn().mockResolvedValue({
        id: 1,
        category: "NOTE",
        name: "Original",
        description: "old prose",
      }),
    });
    await updateEvent(client, { id: 1, description: "new prose" });

    expect(client.updateEvent).toHaveBeenCalledWith(1, {
      description: "new prose",
    });
  });

  it("metadata-only update does not fetch the existing event (no extra round-trip)", async () => {
    const client = createMockClient();
    await updateEvent(client, { id: 1, name: "Renamed", color: "#abc" });

    expect(client.getEvent).not.toHaveBeenCalled();
    expect(client.updateEvent).toHaveBeenCalledWith(1, {
      name: "Renamed",
      color: "#abc",
    });
  });
});

describe("deleteEvents tool handler", () => {
  it("deletes events and returns success", async () => {
    const client = createMockClient();
    const result = await deleteEvents(client, {
      ids: [{ id: 1 }, { external_id: "test-2" }],
    });
    const parsed = result;

    expect(parsed.success).toBe(true);
    expect(parsed.deleted).toBe(2);
    expect(client.deleteEvents).toHaveBeenCalledWith([
      { id: 1 },
      { external_id: "test-2" },
    ]);
  });
});
