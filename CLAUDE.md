# intervals-icu-mcp

MCP server for the Intervals.icu API.

## Architecture

- **Services** (`src/services/`) — business logic behind interfaces (`IWorkoutBuilder`, `IEventsApi`, `IWorkoutLibrary`). Each service has `types.ts`, implementation, and `index.ts` re-exporting the interface + factory. Larger services (`workout-library/`) split into multiple files (api/parser/seed/refresh/create/library) — same pattern, more surface.
- **Client** (`src/client.ts`) — `HttpClient` with Basic auth, rate limiting, injectable `fetchFn` for testing.
- **Facade** (`src/index.ts`) — `IntervalsClient` composes services, implements `IIntervalsClient`.
- **MCP layer** (`src/mcp/`) — thin tool registrations in `tools/`, `server.ts` wires tools to client, `stdio.ts` is the entry point. `syntax-doc.ts` is the single source of truth for the `instructions` field — server-tool-binding guidance only (workout-text syntax, watts-at-API rule, tool inventory). `prompts/` registers user-invokable MCP prompts.
- **Tests** (`tests/`) — mirror `src/` structure. Use injectable fetch (not global mocks).

New tools/services should follow this pattern: service with interface → tool handler that delegates → register in `server.ts`.

## Intervals.icu API

- **Auth**: Basic auth with `API_KEY:{key}` (base64 encoded)
- **Athlete ID**: use `0` for authenticated user
- **Base URL**: `https://intervals.icu`
- **Create events**: `POST /api/v1/athlete/{id}/events/bulk?upsert=true` — body is array of events, matched by `external_id` for upsert
- **Delete events**: `PUT /api/v1/athlete/{id}/events/bulk-delete` — body is array of `{ external_id }` or `{ id }`
- **Folders + saved workouts**: `GET /api/v1/athlete/{id}/folders` returns a tree of `{ type: "FOLDER", children: [...] }` mixing nested folders and workouts (distinguished by `type`). `POST .../folders` ignores any `parent` field — folders are flat in practice. `POST .../workouts` requires `type` (default to `"Ride"`) and `folder_id`. `PUT .../workouts/{id}` updates a saved workout. `DELETE` works on both.
- **Full API docs**: https://intervals.icu/api-docs.html (JS SPA — won't render via fetch, use forum posts instead)
- **Forum API reference**: https://forum.intervals.icu/t/uploading-planned-workouts-to-intervals-icu/63624

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

## Config

| Env var                | Required | Default |
| ---------------------- | -------- | ------- |
| `INTERVALS_API_KEY`    | Yes      | —       |
| `INTERVALS_ATHLETE_ID` | No       | `0`     |
