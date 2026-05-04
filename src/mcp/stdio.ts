#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { IntervalsClient } from "../index.js";
import { createMcpServer } from "./server.js";
import { loadCoachingInstructions } from "./coaching.js";

async function main() {
  let client: IntervalsClient;
  try {
    client = new IntervalsClient();
  } catch (error) {
    console.error("[intervals-icu-mcp] Failed to create client:", error);
    process.exit(1);
  }

  const coachingInstructions = await loadCoachingInstructions();
  const server = createMcpServer(client, { coachingInstructions });
  const transport = new StdioServerTransport();

  process.on("SIGINT", () => {
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    process.exit(0);
  });

  await server.connect(transport);
}

main().catch((error) => {
  console.error("[intervals-icu-mcp] Fatal:", error);
  process.exit(1);
});
