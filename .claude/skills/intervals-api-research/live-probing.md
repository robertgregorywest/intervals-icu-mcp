# Live-probing patterns

Three escalating probe styles. Pick the lightest that answers the question.

## 1. Existing MCP tool (cheapest — when wrapped)

If the endpoint is already wrapped by a `mcp__intervals-icu__*` tool, call it directly with realistic args and inspect the JSON. Examples worth knowing:

- `mcp__intervals-icu__get_activities` — recent activities list shape.
- `mcp__intervals-icu__get_activity` — full activity detail with all metric fields.
- `mcp__intervals-icu__get_activity_streams` — stream payload shape (sparse arrays, nullables).
- `mcp__intervals-icu__get_athlete` — athlete profile, zones, custom items.
- `mcp__intervals-icu__get_events` / `get_event` — calendar event shape including `external_id`, `description`, workout-text rendering.
- `mcp__intervals-icu__get_wellness` — daily wellness records (which fields are nullable when not logged).
- `mcp__intervals-icu__list_workout_library` / `get_workout_library_item` — folder tree + saved-workout shape.

Inspect output for: nullable fields, casing (`activity_id` vs `id`), array-vs-object containers, fields that disappear when empty.

## 2. Throwaway `scripts/` probe (medium — for un-wrapped endpoints)

Mirror the existing `scripts/exercise-*.mjs` convention. Template:

```js
#!/usr/bin/env node
// scripts/probe-eventcategories.mjs
import "dotenv/config";

const apiKey = process.env.INTERVALS_API_KEY;
const athleteId = process.env.INTERVALS_ATHLETE_ID || "0";
if (!apiKey) throw new Error("INTERVALS_API_KEY required");

const auth = "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64");
const url = `https://intervals.icu/api/v1/athlete/${athleteId}/eventcategories`;

const res = await fetch(url, { headers: { Authorization: auth } });
console.log(res.status, res.headers.get("content-type"));
const body = await res.text();
try {
  console.log(JSON.stringify(JSON.parse(body), null, 2));
} catch {
  console.log(body);
}
```

Run with `node scripts/probe-*.mjs`. Delete the file (or check it in alongside its companion service) once the shape is captured. Don't let probes accumulate.

For endpoints with rate limits, retries, or pagination, import `HttpClient` from `src/client.ts` instead of raw fetch — it already handles Basic auth, rate limiting, and safe parsing. Same `INTERVALS_API_KEY` env var.

## 3. One-shot curl (lightest — for a single GET)

When you just want to see one response and a script feels heavy:

```bash
source .env  # or: export INTERVALS_API_KEY=...
curl -sS -u "API_KEY:$INTERVALS_API_KEY" \
  "https://intervals.icu/api/v1/athlete/0/eventcategories" | jq
```

Good for read-only `GET` checks. Don't curl mutations against the live account without confirming with the user — bulk upserts and deletes hit production data.

## Edge cases to verify live

Even after the happy-path response looks right, confirm:

- **Empty result** — does the endpoint return `[]`, `null`, `{}`, or omit the key? (Try a date range with nothing in it.)
- **Optional fields** — does an entity with a field unset return `null`, omit the key, or return `""` / `0`?
- **Date format** — ISO with `Z`? Local time? Epoch? Confirm before parsing.
- **Bulk vs. single** — list endpoints sometimes return a thinner projection than the single-resource endpoint. Don't assume parity.
- **Upsert keys** — `external_id` matching is case-sensitive on some endpoints; confirm.

## Capture the response

When you commit the change, paste the trimmed live response into the PR description or commit body. The next person debugging the parser should not have to re-probe to know what the shape was on the day you coded it.
