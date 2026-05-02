import { describe, it, expect, vi } from "vitest";
import {
  getEvents,
  getEvent,
  updateEvent,
  deleteEvents,
} from "../../../src/mcp/tools/events.js";
import type { IIntervalsClient } from "../../../src/index.js";

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
      description: "- 10m 60%",
    }),
    updateEvent: vi.fn().mockResolvedValue({
      id: 1,
      name: "Updated Workout",
    }),
    deleteEvents: vi.fn().mockResolvedValue(undefined),
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
    const parsed = JSON.parse(result);

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
    const parsed = JSON.parse(result);

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
    const parsed = JSON.parse(result);

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
});

describe("deleteEvents tool handler", () => {
  it("deletes events and returns success", async () => {
    const client = createMockClient();
    const result = await deleteEvents(client, {
      ids: [{ id: 1 }, { external_id: "test-2" }],
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.deleted).toBe(2);
    expect(client.deleteEvents).toHaveBeenCalledWith([
      { id: 1 },
      { external_id: "test-2" },
    ]);
  });
});
