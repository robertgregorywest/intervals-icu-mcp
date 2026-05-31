# intervals-icu-mcp

MCP server for the Intervals.icu API plus tools to support agentic coaching.

## Architecture

- **Services** (`src/services/`) — business logic behind interfaces (`IWorkoutBuilder`, `IEventsApi`, `IWorkoutLibrary`). Each service has `types.ts`, implementation, and `index.ts` re-exporting the interface + factory. Larger services (`workout-library/`) split into multiple files (api/parser/seed/refresh/create/library) — same pattern, more surface.
- **Client** (`src/client.ts`) — `HttpClient` with Basic auth, rate limiting, injectable `fetchFn` for testing.
- **Facade** (`src/index.ts`) — `IntervalsClient` composes services, implements `IIntervalsClient`.
- **Tool registry** (`src/registry.ts`) — single source of truth for all 23 Tools (`ToolDef[]`). Each entry has `name`, `description`, `schema`, `annotations`, `outputSchema`, `handler`. Both adapters iterate this list.
- **Tools** (`src/tools/`) — handler implementations (schema + handler pairs) shared across adapters.
- **MCP adapter** (`src/mcp/`) — `server.ts` iterates `TOOLS` and registers each via `registerTool()`. `syntax-doc.ts` is the single source of truth for `instructions`. `prompts/` registers user-invokable MCP prompts.
- **CLI adapter** (`src/cli/main.ts`) — projects `TOOLS` as Bash subcommands; `bin/icu` is the checked-in entrypoint.
- **Tests** (`tests/`) — mirror `src/` structure. Use injectable fetch (not global mocks).

New tools/services should follow this pattern: service with interface → tool handler in `src/tools/` → entry in `src/registry.ts` → both adapters pick it up automatically.

## Ways of working

- **Probe live before typing.** Before designing or implementing changes that touch Intervals.icu request bodies, response parsing, or query params — call a real endpoint and inspect the JSON. Do not invent shapes from memory or extrapolate from sibling endpoints. The `intervals-api-research` skill (`.claude/skills/intervals-api-research/`) holds the workflow, probe templates, and endpoint index — it auto-loads on API-surface work.

## Intervals.icu API

- **Base URL**: `https://intervals.icu`
- **Auth**: Basic with `API_KEY:{key}` (base64). Username is the literal `API_KEY`.
- **Athlete ID**: pass `0` for the authenticated user.
- **Endpoints, quirks, doc links** → `.claude/skills/intervals-api-research/endpoint-reference.md`.

### Workout text syntax

The runtime source of truth for the workout-text syntax block is `src/mcp/syntax-doc.ts` — that string is what the server injects into MCP `instructions` at startup. Keep this section here as a quick reference for humans, but mirror any changes back to `syntax-doc.ts` (or vice versa).

```
- [label] [duration] [target] [cadence]     # simple step
- [label] [duration] ramp [target] [cadence] # ramp step
Nx                                            # repeat block (blank lines around)
- step
- step
```

- Duration: `5m`, `30s`, `1h2m30s`, `2km`, `500mtr` (`m` = minutes, `mtr` = meters)
- Power: `75%`, `95-105%`, `220w`, `Z2`
- HR: `70% HR`, `Z2 HR`, `95% LTHR`
- Pace: `60% Pace`, `Z2 Pace`, `5:00/km Pace`
- Cadence: `90rpm`

### Saved-workout rationale block

Saved workouts in the library can carry an HTML-comment rationale block at the end of their description that captures the %MAP/%FTP intent behind the absolute watts. Format: `<!-- rationale {"basis":"MAP","anchorWatts":380,"seedId":"vo2-4x4","intensities":[{"stepRef":"On","pct":[95,102]},...]} -->`. The block is invisible in the Intervals.icu UI; it makes a workout refreshable via `refresh_workout_library` when MAP or FTP changes (text-munges only the watts in step lines, leaves prose/labels/durations/cadence alone).

### Coaching architecture

The server `instructions` field is intentionally lean — workout-text syntax, watts-at-API rule, tool inventory. Anything that changes per-athlete or per-week lives elsewhere:

- **Workout-generation rules** — `intervals-coach` skill at `.claude/skills/intervals-coach/` (SKILL.md entry, plus `power-conversion.md`, `session-patterns.md`, `library-vs-compose.md`, `syntax-cheatsheet.md` for progressive disclosure). Reloads per session.
- **Coaching philosophy + season** — user uploads `philosophy.md` and `season.md` as Claude Project knowledge. The `setup_coaching` MCP prompt interviews and emits these as artifacts. Templates live at `templates/project-knowledge/`.
- **Athlete state** — `get_coaching_context` tool bundles `getAthlete` + `getWellness(days)` + computed CTL/ATL/TSB into one snapshot. Default 7-day wellness window, max 30. Always fresh — no files to maintain.
- **MAP** — derived in the same tool: scans the last 90 days of activities, picks the most recent whose name (case-insensitive) starts with `"MAP ramp test"` and does **not** contain `"(skip)"`, runs `computeBestPower(stream, 60)` on its watts stream, returns `{ map: { watts, computedFrom: { metric, activityId, activityName, activityDate, daysAgo } } }`. No qualifying test → `map: null` plus a `mapWarning` for the LLM to act on. Athletes exclude botched tests by renaming the activity in Intervals.icu to include `(skip)`.

Saved workouts can still encode %MAP/%FTP intent via the rationale block (see above) so `refresh_workout_library` can re-anchor them when test values change.

## CLI adapter

The `bin/icu` CLI is the agent's zero-reconnect dev surface. It runs via `npx tsx` so every invocation uses the latest source without a rebuild or MCP reconnect.

```bash
# Self-describe: full tool catalogue with input schemas
./bin/icu describe

# Narrow to specific tools
./bin/icu describe get_athlete create_workout

# Invoke a read-only tool
./bin/icu get_athlete
./bin/icu get_coaching_context --json '{"days":14}'
echo '{}' | ./bin/icu get_athlete   # stdin also works (not yet; planned)

# Invoke a mutating tool (requires --yes)
./bin/icu delete_events --json '{"ids":[{"id":1}]}' --yes
```

**Allowlisting for agent use** — split by annotation prefix:

- Read commands (`get_*`, `list_*`, `compute_*`, `compare_*`, `describe`): allowlist as read-only Bash.
- Mutating commands (`delete_events`, `update_event`): require explicit `--yes`; prompt user before adding to allowlist.
- Upsert commands (`create_*`, `refresh_*`, `seed_*`): run freely; idempotent.

`--help` prints a breadcrumb pointing at `describe`. On TTY, output is pretty-printed (2-space JSON); piped/non-TTY output is compact single-line JSON.

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
