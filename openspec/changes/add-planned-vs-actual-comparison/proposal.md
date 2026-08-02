## Why

The coaching loop is prescribe → execute → verify → adjust, and the server has no verify step. It can write a structured workout (`create_workout`) and read what was ridden (`get_activity`), but nothing compares the two, so "was this session executed as prescribed?" can only be answered by manually lining up an event's steps against an activity's intervals and eyeballing them. That is error-prone enough that a wrong reading of a session's execution can survive for weeks and drive downstream block decisions — while the Load check in `coaching-session` stays entirely on _planned_ load and never notices.

The data to close the gap already exists and is already linked. Probed live 2026-08-02:

- A completed activity carries `paired_event_id`, so the planned event resolves without date-guessing.
- The event carries `workout_doc.steps` — Intervals.icu's own parse of the workout text, as `{text, duration, power, cadence}`, with repeat blocks as nested `{reps, steps[]}`. No re-parsing of the `- step` grammar is needed.
- The activity carries `icu_intervals` with `elapsed_time`, `average_watts`, `average_cadence`, `average_heartrate`.
- The activity also carries a scalar `compliance` (e.g. `73.9726`) computed by Intervals.icu. It is a useful corroborating number but has no per-step detail and no explanation, which is precisely what a coach needs.

## What Changes

- New read-only tool `compare_planned_vs_actual`, exposed through both adapters via the tool registry.
  - Args: exactly one of `activityId` or `eventId` (the other resolved via `paired_event_id`), optional `tolerance` (fractional, default `0.05`).
  - Returns a step-by-step alignment: per planned step, the prescribed duration and power target alongside the delivered duration and average power, the deltas, and a verdict (`on-target` / `over` / `under` / `not-attempted` / `unmatched`).
  - Returns a session roll-up: planned vs actual load, total planned vs actual work time, Intervals.icu's own `compliance` value, and any recorded interval that maps to no planned step.
  - Reports an explicit **alignment basis** (`sequential`, `duration`, `none`) plus a confidence signal, so the caller can see _how_ the pairing was reached.
  - Repeat blocks are expanded and compared rep-by-rep, since decay across reps is usually the interesting part.
- New service `src/services/session-review/` behind an `ISessionReview` interface, following the existing service pattern (`types.ts`, implementation, `index.ts`), composed into `IntervalsClient`.
- Alignment is deliberately conservative: when it cannot pair steps to intervals with confidence, it says so rather than guessing. A plausible-looking wrong alignment is worse than no tool, because it is the exact failure mode this change exists to eliminate.
- Gaps are never silently filled. No paired event, no `workout_doc`, or no recorded intervals each produce a named, explicit reason in the response.
- No breaking changes. No existing tool's behaviour or output changes.

## Capabilities

### New Capabilities

- `planned-vs-actual-comparison`: resolving a completed activity to its planned event, aligning planned workout steps to recorded intervals conservatively, and reporting per-step and whole-session execution verdicts with an explicit alignment basis and explicit refusal when alignment is not possible.

### Modified Capabilities

None. `openspec/specs/` is currently empty, and no existing tool's requirements change.

## Impact

- **New**: `src/services/session-review/` (service + types), `src/tools/session-review.ts` (handler + zod schemas), one entry in `src/registry.ts`, tests under `tests/services/session-review/` and `tests/tools/`, fixtures under `tests/fixtures/session-review/`.
- **Touched**: `src/index.ts` (compose the service into `IntervalsClient`), `src/types.ts` (add `workout_doc` to the event shape), `src/services/activities/types.ts` (add `paired_event_id`, `compliance`).
- **Adapters**: MCP and CLI both project the tool automatically from the registry, so neither needs adapter-specific code — but registration alone does not make a tool _discoverable_. `src/mcp/syntax-doc.ts` (the instructions the server supplies on connection) must name it, or a calling model never learns it exists, and `manifest.json` must declare it or `npm run check:manifest` fails before release. Both are manual edits the registry does not drive.
- **Docs**: `README.md` (tool table and capability list) and `CONTEXT.md` (the vocabulary this introduces — planned step, delivered interval, alignment basis, verdict).
- **API**: read-only. Uses existing endpoints — `GET /api/v1/activity/{id}` and `GET /api/v1/athlete/{id}/events/{eventId}`. No new endpoints, no writes, no new dependencies.
- **Downstream**: the `coaching-session` skill gains a verify step it can call before drawing conclusions about a block; that skill's guidance should be updated to use it, but that is follow-on work, not part of this change.

## Follow-ups (out of scope here)

- Update the `coaching-session` skill so its Load check calls `compare_planned_vs_actual` on the block's key sessions before drawing conclusions from planned load. The tool closes the data gap; wiring it into the coaching workflow is a separate change.
- Consider whether sub-5-second auto-detected intervals should be filtered as detector artefacts. They are currently reported as unplanned work, which is honest but noisy, and they demote an otherwise clean session from `sequential` to `duration`. Left alone here because any cut-off risks hiding genuinely short efforts (a standing start is 15–30s) and no threshold is yet justified by data.
