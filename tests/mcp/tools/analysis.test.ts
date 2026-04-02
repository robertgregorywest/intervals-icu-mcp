import { describe, it, expect, vi } from "vitest";
import {
  getAerobicDecoupling,
  compareIntervalsHandler,
} from "../../../src/mcp/tools/analysis.js";
import type { IIntervalsClient } from "../../../src/index.js";

function createMockClient(): IIntervalsClient {
  return {
    getAerobicDecoupling: vi.fn().mockResolvedValue({
      firstHalf: { avgPower: 200, avgHR: 140, hrPowerRatio: 0.7 },
      secondHalf: { avgPower: 200, avgHR: 150, hrPowerRatio: 0.75 },
      decouplingPercent: 7.14,
      interpretation: "Moderate decoupling — aerobic endurance developing",
    }),
    compareIntervals: vi.fn().mockResolvedValue({
      intervals: [
        {
          lapNumber: 1,
          values: [{ activityId: 1, avg_watts: 300 }],
        },
      ],
      summaries: [{ activityId: 1, intervalCount: 1, avgPower: 300 }],
    }),
  } as unknown as IIntervalsClient;
}

describe("getAerobicDecoupling tool handler", () => {
  it("returns decoupling analysis as JSON", async () => {
    const client = createMockClient();
    const result = await getAerobicDecoupling(client, { activityId: 42 });
    const parsed = JSON.parse(result);

    expect(parsed.decouplingPercent).toBe(7.14);
    expect(parsed.interpretation).toContain("Moderate");
    expect(client.getAerobicDecoupling).toHaveBeenCalledWith(42);
  });
});

describe("compareIntervalsHandler", () => {
  it("returns interval comparison as JSON", async () => {
    const client = createMockClient();
    const result = await compareIntervalsHandler(client, {
      activityIds: [1, 2],
      minPower: 200,
    });
    const parsed = JSON.parse(result);

    expect(parsed.intervals).toHaveLength(1);
    expect(parsed.summaries).toHaveLength(1);
    expect(client.compareIntervals).toHaveBeenCalledWith([1, 2], {
      minPower: 200,
      targetDuration: undefined,
      durationTolerance: undefined,
    });
  });
});
