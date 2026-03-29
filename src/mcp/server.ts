import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IIntervalsClient } from "../index.js";
import { logResponse, logError } from "./logger.js";
import { createWorkoutSchema, createWorkout } from "./tools/workouts.js";

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
    handler: (args: any) => Promise<string>,
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
      },
    );
  }

  tool(
    "create_workout",
    "Create a structured workout on the athlete's Intervals.icu calendar. " +
      "Provide workout steps using Intervals.icu text syntax for targets " +
      '(e.g. "75%", "200w", "Z2", "70% HR", "5:00/km Pace"). ' +
      "Supports simple steps, ramps, and repeat blocks.",
    createWorkoutSchema.shape,
    (args) => createWorkout(client, args),
  );

  return server;
}
