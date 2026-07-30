# intervals-icu-mcp

MCP server for the Intervals.icu API plus tools to support agentic coaching.

## Architecture

- **Services** (`src/services/`) — business logic behind interfaces (`IWorkoutBuilder`, `IEventsApi`, `IWorkoutLibrary`). Each service has `types.ts`, implementation, and `index.ts` re-exporting the interface + factory. Larger services (`workout-library/`) split into multiple files (api/parser/template/render/loader/sync/library) — same pattern, more surface.
- **Client** (`src/client.ts`) — `HttpClient` with Basic auth, rate limiting, injectable `fetchFn` for testing.
- **Facade** (`src/index.ts`) — `IntervalsClient` composes services, implements `IIntervalsClient`.
- **Tool registry** (`src/registry.ts`) — single source of truth for all Tools (`ToolDef[]`). Both adapters iterate this list — see `docs/adr/0001-cli-adapter-and-tool-registry.md`.
- **Tools** (`src/tools/`) — handler implementations, shared across adapters.
- **MCP adapter** (`src/mcp/`) — `server.ts` registers each Tool; `syntax-doc.ts` is the source of truth for the workout-text `instructions`; `prompts/` registers MCP prompts.
- **CLI adapter** (`src/cli/main.ts`, entrypoint `bin/icu`) — projects Tools as Bash subcommands via `tsx`, so it always runs the latest `src/` with no rebuild or MCP reconnect. Use it while iterating on a tool's own source; use the MCP tools (`mcp__intervals-icu__*`) for real coaching use, since the MCP process won't see `src/` edits until reconnected. `./bin/icu describe` prints the full catalogue; mutating commands need `--yes`. Allowlist `get_*`/`list_*`/`compute_*`/`compare_*`/`describe` as read-only; run `create_*`/`sync_*` freely (idempotent); prompt before allowlisting mutating commands. See `docs/adr/0002-cli-json-input.md`.
- **Tests** (`tests/`) — mirror `src/` structure. Use injectable fetch (not global mocks).

New tools/services: service with interface → tool handler in `src/tools/` → entry in `src/registry.ts` → both adapters pick it up automatically.

Domain vocabulary (Tool/Adapter/Projection/MAP zones/Workout template/Sync/Basis/...) is defined once in `CONTEXT.md` — read it before naming something new.

## Ways of working

- **Probe live before typing.** Before designing or implementing changes that touch Intervals.icu request bodies, response parsing, or query params, call a real endpoint and inspect the JSON — don't invent shapes from memory. The `intervals-api-research` skill holds the workflow and endpoint index.

## Intervals.icu API

- **Base URL**: `https://intervals.icu`. **Auth**: Basic `API_KEY:{key}` (base64), username literal `API_KEY`. **Athlete ID**: `0` for the authenticated user.
- **Endpoints, quirks, doc links** → `.claude/skills/intervals-api-research/endpoint-reference.md`.
- **Workout-text syntax** (the `- step` / `Nx` repeat grammar the API expects in `description` fields) — runtime source of truth is `src/mcp/syntax-doc.ts`, which the server injects as MCP `instructions`; edit there, not here.

### Workout templates

Curated library workouts are tracked Markdown files in `templates/workouts/*.md` (`templates/personal/` is unrelated — scaffolds for the personal season/steering files). The files are the source of truth; `sync_workout_library` renders each at the current MAP/FTP and upserts it onto Intervals.icu, matched by a `<!-- template: <seedId> -->` marker. Hand edits in the Intervals.icu UI are overwritten. `tests/fixtures/rendered-templates.txt` is the committed render at MAP=415/FTP=290 — regenerate with `npm test -- -u` after an intentional template edit and review the diff. Full frontmatter shape, anchoring rules, and edge cases: `docs/adr/0005-workout-templates-as-tracked-files.md` and the `intervals-coach` skill's `library-vs-compose.md`.

### Coaching architecture

Coaching context is a four-tier stack, most-durable first, later tiers win on conflict: **philosophy** (tracked, `coaching-philosophy` skill) → **steering** (personal, gitignored, `docs/personal/steering.md`) → **season** (personal, gitignored, `docs/personal/season.md`) → **coaching log** (personal, gitignored, `docs/personal/coaching-log.md`). The `coaching-session` skill (broad conversation) and `intervals-coach` skill (single workout) both read this stack at session-start; `strength-training` is the gym-session sibling. `setup_coaching` MCP prompt bootstraps `season.md`/`steering.md`. `get_coaching_context` is the live athlete-state snapshot (FTP/MAP/zones/CTL-ATL-TSB/wellness) — never filed, always fresh. Rationale: `docs/adr/0003-coaching-context-map-zones.md`, `docs/adr/0004-coaching-philosophy-as-tracked-skill.md`.

## Config

| Env var                | Required | Default |
| ---------------------- | -------- | ------- |
| `INTERVALS_API_KEY`    | Yes      | —       |
| `INTERVALS_ATHLETE_ID` | No       | `0`     |

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `robertgregorywest/intervals-icu-mcp` (use the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label vocabulary, no overrides. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
