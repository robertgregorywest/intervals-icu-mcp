# intervals-icu-mcp

MCP server for the Intervals.icu API. Architecturally mirrors `trainingpeaks-mcp` (`/Users/rob/Git/GitHub/robertgregorywest/trainingpeaks-mcp`).

## Commands

- `npm run build` — compile TypeScript
- `npm test` — run vitest
- `npm run typecheck` — type-check without emitting
- `npm start` — run MCP server via stdio

## Architecture

- **Services** (`src/services/`) — business logic behind interfaces (`IWorkoutBuilder`, `IEventsApi`). Each service has `types.ts`, implementation, and `index.ts` re-exporting the interface + factory.
- **Client** (`src/client.ts`) — `HttpClient` with Basic auth, rate limiting, injectable `fetchFn` for testing.
- **Facade** (`src/index.ts`) — `IntervalsClient` composes services, implements `IIntervalsClient`.
- **MCP layer** (`src/mcp/`) — thin tool registrations in `tools/`, `server.ts` wires tools to client, `stdio.ts` is the entry point.
- **Tests** (`tests/`) — mirror `src/` structure. Use injectable fetch (not global mocks).

New tools/services should follow this pattern: service with interface → tool handler that delegates → register in `server.ts`.

## Intervals.icu API

- **Auth**: Basic auth with `API_KEY:{key}` (base64 encoded)
- **Athlete ID**: use `0` for authenticated user
- **Base URL**: `https://intervals.icu`
- **Create events**: `POST /api/v1/athlete/{id}/events/bulk?upsert=true` — body is array of events, matched by `external_id` for upsert
- **Delete events**: `PUT /api/v1/athlete/{id}/events/bulk-delete` — body is array of `{ external_id }` or `{ id }`
- **Full API docs**: https://intervals.icu/api-docs.html (JS SPA — won't render via fetch, use forum posts instead)
- **Forum API reference**: https://forum.intervals.icu/t/uploading-planned-workouts-to-intervals-icu/63624

### Workout text syntax (used in event `description` field)

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

## Config

| Env var                | Required | Default |
| ---------------------- | -------- | ------- |
| `INTERVALS_API_KEY`    | Yes      | —       |
| `INTERVALS_ATHLETE_ID` | No       | `0`     |
