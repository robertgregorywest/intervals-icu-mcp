// Deno-only entry for the REMOTE MCP transport (claude.ai web + mobile).
// A second transport of the MCP adapter — reuses createMcpServer + the registry
// unchanged; only credential resolution and the wire are transport-specific.
//
// Run: `deno task serve`   Deploy target: new Deno Deploy (see ADR 0007).
//
// Auth status: DEV mode (single INTERVALS_API_KEY) so the deploy pipeline can be
// proven before the Intervals.icu OAuth app exists. The OAuth broker mounts here
// once registered — see ./remote/oauth-provider.ts (ADR 0006).

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { resolveClient } from "./remote/credentials.js";

const app = express();
app.use(express.json());

// Health check — the target for the Deno Deploy smoke-test.
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", transport: "remote-http" });
});

// TODO(federated): app.use(mcpAuthRouter({ provider: createIcuOAuthProvider(store), ... }))

// Stateless Streamable HTTP: one server+transport per request.
app.post("/mcp", async (req, res) => {
  try {
    const client = await resolveClient(req);
    const server = createMcpServer(client);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: (err as Error).message },
        id: null,
      });
    }
  }
});

const port = Number(Deno.env.get("PORT") ?? 8000);
app.listen(port, () => {
  console.log(`[remote-mcp] listening on :${port}`);
});
