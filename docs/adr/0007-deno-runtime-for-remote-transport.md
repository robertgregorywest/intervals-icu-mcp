# Host the remote MCP transport on Deno (Deno Deploy)

The remote MCP transport runs on **Deno / Deno Deploy** — native TypeScript (no build step), `Deno.KV` for the token store, Web Crypto for token-at-rest, and a free tier that fits this workload. The stdio transport, CLI adapter, and mcpb/desktop artifacts stay on the existing Node/`tsc`/`vitest`/`tsx` toolchain; only the remote transport entry is Deno-specific, and the shared registry/tools/services/`HttpClient` are runtime-agnostic and move untouched.

A spike (2026-06) cleared the two real compatibility risks: the shared `src/` imports into Deno **unmodified** via `--sloppy-imports` over the existing `node_modules`, and the MCP SDK's HTTP pieces (`StreamableHTTPServerTransport`, `mcpAuthRouter`, Express, `node:http`, `createMcpServer`) all import and run under Deno, alongside `Deno.KV` and Web Crypto AES-GCM.

## Consequences

- **Two runtimes in one repo.** Node owns build/test/CLI/mcpb; Deno owns the remote transport. Keep shared code runtime-agnostic so `vitest` coverage carries; Deno-only files (`src/mcp/http.ts`, `src/mcp/remote/**`) are excluded from `tsc` because they reference Deno globals and Express.
- **The run flags are committed, not tribal:** `deno.json` pins `--sloppy-imports`, `--node-modules-dir=manual`, and `--unstable-kv`. `--sloppy-imports` is itself an unstable flag — a future Deno may require real `.ts` extensions, at which point the shared specifiers would need rewriting.
- **`express` must become a direct dependency** — in the spike it resolved only as a transitive dep of the SDK and would vanish on an SDK bump.
- **Deno Deploy Classic shuts down 2026-07-20** — target the new platform.
- **Deploy itself is not yet proven** — docs confirm `node:http`/Express support and the spike runs locally, but a deploy smoke-test on the new free tier is outstanding (status: accepted, deploy verification pending). Gated on a stable callback hostname, which must be fixed before registering the Intervals.icu OAuth app (see ADR 0006).
