# intervals-icu-mcp

MCP server for the Intervals.icu API plus tools to support agentic coaching.

## Architecture

- **Services** (`src/services/`) — business logic behind interfaces (`IWorkoutBuilder`, `IEventsApi`, `IWorkoutLibrary`). Each service has `types.ts`, implementation, and `index.ts` re-exporting the interface + factory. Larger services (`workout-library/`) split into multiple files (api/parser/template/render/loader/sync/library) — same pattern, more surface.
- **Client** (`src/client.ts`) — `HttpClient` with Basic auth, rate limiting, injectable `fetchFn` for testing.
- **Facade** (`src/index.ts`) — `IntervalsClient` composes services, implements `IIntervalsClient`.
- **Tool registry** (`src/registry.ts`) — single source of truth for all 21 Tools (`ToolDef[]`). Each entry has `name`, `description`, `schema`, `annotations`, `outputSchema`, `handler`. Both adapters iterate this list.
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

### Workout templates

Curated library workouts are **tracked Markdown files** in `templates/workouts/*.md`. (`templates/personal/` is a different thing entirely — scaffolds for the personal season/steering files.) The files are the source of truth and the Intervals.icu library is a rendered view: `sync_workout_library` renders each template at the current MAP/FTP and upserts it, matched by a `<!-- template: <seedId> -->` marker in the description. Hand edits in the Intervals.icu UI are overwritten. See ADR 0005.

```markdown
---
seedId: vo2-4x4 # stable identity; matches the remote workout
name: VO2 4×4
folder: "Coach: VO2 Max" # created if missing
basis: MAP # MAP | FTP; omit when nothing is anchored
purpose: Default VO2 session. # REQUIRED — how the coach selects it
---

Free prose (rationale, citations) — rendered above the steps.

- Warm-up 15m 50-60%

4x

- On 4m 95-102%
- Off 4m 50%

- Cooldown 10m 45%
```

- **Bare `%` is anchored** to `basis` and resolves to watts (rounded to 5 W) at render. **Everything else is verbatim** — `350w`, `Z2`, `64-75% LTHR`, `90rpm` — and never moves when MAP/FTP moves. A percentage is anchored only when _no modifier follows it_. A template with no bare `%` needs no `basis` and always syncs (that's how the fixed MAP ramp-test protocol stays comparable across retests).
- **Repeats nest by indentation.** Blank lines are ignored; only indent matters. At render, a block containing another block is **unrolled** (label discarded) and a block of plain steps becomes a native `Nx` — Intervals.icu supports only one level.
- **`ramp` is a parse error.** A ramp collapses to one averaged target on head units; write explicit steps.
- **Adding a library workout means writing a file** in `templates/workouts/`. There is no tool that creates an unmanaged library item — anything without a template would silently sit at a stale anchor. One-off sessions go on the calendar via `create_workout`.
- Sync **never deletes**: a marker-bearing workout with no template is reported as an orphan. A pre-marker workout is adopted only if its name _and_ folder match a template exactly and uniquely.

### Coaching architecture

The server `instructions` field is intentionally lean — workout-text syntax, watts-at-API rule, tool inventory. The coaching context is a **four-tier stack**, most-durable first; later tiers override earlier ones on conflict:

1. **Coaching philosophy** (durable, tracked) — `coaching-philosophy` skill at `.claude/skills/coaching-philosophy/` (SKILL.md operative core — pillars, intensity anchor, execution rules, biases, test cadence — plus topic subfiles for progressive disclosure). The base every install shares; edit it (a commit) when training beliefs change.
2. **Steering** (personal, gitignored) — `docs/personal/steering.md`, a thin per-athlete override layer that **wins on conflict** with the philosophy. Durable steering graduates _up_ into the skill.
3. **Season** (personal, gitignored) — `docs/personal/season.md`: current block, races, macro structure, constraints.
4. **Coaching log** (personal, gitignored) — `docs/personal/coaching-log.md`: session-by-session tier.

Other coaching surfaces:

- **Workout-generation rules** — `intervals-coach` skill at `.claude/skills/intervals-coach/` (SKILL.md entry, plus `power-conversion.md`, `session-patterns.md`, `library-vs-compose.md`, `syntax-cheatsheet.md` for progressive disclosure). Reloads per session.
- **Session orchestration** — `coaching-session` skill reads the four-tier stack at session-start and delegates workout writes to `intervals-coach`.
- **Bootstrapping personal files** — the `setup_coaching` MCP prompt interviews for season + steering and emits `season.md`/`steering.md`; scaffolds live at `templates/personal/`. Philosophy is not authored here — it's the tracked skill.
- **Athlete state** — `get_coaching_context` tool bundles `getAthlete` + `getWellness(days)` + computed CTL/ATL/TSB into one snapshot. Default 7-day wellness window, max 30. Always fresh — no files to maintain.
- **MAP** — derived in the same tool: scans the last 90 days of activities, picks the most recent whose name (case-insensitive) starts with `"MAP ramp test"` and does **not** contain `"(skip)"`, runs `computeBestPower(stream, 60)` on its watts stream, returns `{ map: { watts, computedFrom: { metric, activityId, activityName, activityDate, daysAgo } } }`. No qualifying test → `map: null` plus a `mapWarning` for the LLM to act on. Athletes exclude botched tests by renaming the activity in Intervals.icu to include `(skip)`.

When a test value changes, run `sync_workout_library` with the new anchors — every MAP/FTP-anchored template is re-rendered from source, so watts, structure and prose all stay in step.

## CLI adapter

The `bin/icu` CLI is the agent's zero-reconnect dev surface. It runs via `npx tsx` so every invocation uses the latest source without a rebuild or MCP reconnect.

**Which surface when.** The MCP server is a long-lived process: it serves the tool code loaded at session start and won't reflect `src/` edits until you reconnect it. So real/coaching use goes through the MCP tools (`mcp__intervals-icu__*`); when you're iterating on a tool's own source, drive it via `bin/icu` (fresh `src/` every call) and reconnect the MCP once you're done.

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
- Upsert commands (`create_*`, `sync_*`): run freely; idempotent.

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
