import { describe, it, expect, vi } from "vitest";
import {
  getWellness,
  getFitnessSummary,
} from "../../../src/mcp/tools/wellness.js";
import type { IIntervalsClient } from "../../../src/index.js";

function createMockClient(): IIntervalsClient {
  return {
    getWellness: vi
      .fn()
      .mockResolvedValue([{ date: "2024-01-01", ctl: 60, atl: 70 }]),
    getFitnessSummary: vi.fn().mockResolvedValue({
      date: "2024-01-15",
      ctl: 62,
      atl: 55,
    }),
  } as unknown as IIntervalsClient;
}

describe("getWellness tool handler", () => {
  it("returns wellness data as JSON", async () => {
    const client = createMockClient();
    const result = await getWellness(client, {
      oldest: "2024-01-01",
      newest: "2024-01-31",
    });
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].ctl).toBe(60);
  });
});

describe("getFitnessSummary tool handler", () => {
  it("returns today's fitness snapshot", async () => {
    const client = createMockClient();
    const result = await getFitnessSummary(client);
    const parsed = JSON.parse(result);

    expect(parsed.ctl).toBe(62);
    expect(client.getFitnessSummary).toHaveBeenCalledOnce();
  });
});
