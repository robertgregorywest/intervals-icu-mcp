import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IIntervalsClient } from "../index.js";
import { logResponse, logError } from "./logger.js";
import {
  createWorkoutSchema,
  createWorkout,
  createStrengthWorkoutSchema,
  createStrengthWorkout,
} from "./tools/workouts.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function createMcpServer(client: IIntervalsClient): McpServer {
  const server = new McpServer({
    name: "intervals-icu-mcp",
    version,
  });

  function tool(
    name: string,
    description: string,
    schema: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => Promise<string>
  ): void {
    server.tool(
      name,
      description,
      schema,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (args: any): Promise<ToolResult> => {
        const start = Date.now();
        try {
          const content = await handler(args);
          logResponse(name, content, Date.now() - start);
          return { content: [{ type: "text", text: content }] };
        } catch (error) {
          logError(name, error as Error, Date.now() - start);
          throw error;
        }
      }
    );
  }

  tool(
    "create_workout",
    "Create a structured workout on the athlete's Intervals.icu calendar. " +
      "IMPORTANT: When the user specifies power targets in watts, always use absolute watts " +
      '(e.g. "200w", "160w-256w") — do NOT convert to percentages. ' +
      'Percentage targets like "75%" are relative to FTP which may not match the user\'s intent. ' +
      "Supports simple steps, ramps, and repeat blocks.",
    createWorkoutSchema.shape,
    (args) => createWorkout(client, args)
  );

  tool(
    "create_strength_workout",
    "Create a strength/gym session on the athlete's Intervals.icu calendar as a WeightTraining event. " +
      "Provide a free-form description of exercises, sets, reps, load, and RPE. " +
      "Use this instead of create_workout for gym/strength sessions.",
    createStrengthWorkoutSchema.shape,
    (args) => createStrengthWorkout(client, args)
  );

  return server;
}
