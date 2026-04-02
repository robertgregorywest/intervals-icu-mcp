import { describe, it, expect, vi } from "vitest";
import { getPowerCurve } from "../../../src/mcp/tools/power.js";
import type { IIntervalsClient } from "../../../src/index.js";

function createMockClient(): IIntervalsClient {
  return {
    getPowerCurve: vi.fn().mockResolvedValue([
      { secs: 5, value: 900, activity_id: 1 },
      { secs: 60, value: 400, activity_id: 2 },
      { secs: 300, value: 320, activity_id: 1 },
    ]),
  } as unknown as IIntervalsClient;
}

describe("getPowerCurve tool handler", () => {
  it("returns power curve as JSON", async () => {
    const client = createMockClient();
    const result = await getPowerCurve(client, {});
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(3);
    expect(parsed[0].secs).toBe(5);
    expect(parsed[0].value).toBe(900);
  });

  it("passes type and range options", async () => {
    const client = createMockClient();
    await getPowerCurve(client, { type: "Ride", range: "90d" });

    expect(client.getPowerCurve).toHaveBeenCalledWith({
      type: "Ride",
      range: "90d",
    });
  });
});
