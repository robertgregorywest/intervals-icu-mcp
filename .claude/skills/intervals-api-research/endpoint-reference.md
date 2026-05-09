# Endpoint reference

Index of Intervals.icu endpoints currently used by this server, plus quirks worth knowing. **This is a pointer, not a contract.** Always confirm shapes against a live response before coding (see `live-probing.md`) — fields drift, the docs SPA lags reality, and shapes vary between sibling endpoints.

## Connection basics

- **Base URL**: `https://intervals.icu`
- **Auth**: HTTP Basic with `API_KEY:{key}` (base64 encoded). Username is the literal string `API_KEY`.
- **Athlete ID**: pass `0` to mean "the authenticated user" — avoids hard-coding the numeric ID.

## Events (calendar)

- `POST /api/v1/athlete/{id}/events/bulk?upsert=true` — body is a JSON array of events. Upsert match key is `external_id`. Use this for both new and updated planned workouts.
- `PUT /api/v1/athlete/{id}/events/bulk-delete` — body is an array of `{ external_id }` or `{ id }`. Either matcher works.
- `GET /api/v1/athlete/{id}/events` — list, supports `oldest`/`newest` date filters.
- `GET /api/v1/athlete/{id}/events/{eventId}` — single event.

## Folders + saved workouts (the workout library)

- `GET /api/v1/athlete/{id}/folders` — returns a tree of `{ type: "FOLDER", children: [...] }`. Children mix nested folders and workouts; distinguish by `type`. **Quirk:** folders are flat in practice; `parent` on `POST` is ignored.
- `POST /api/v1/athlete/{id}/folders` — create folder.
- `POST /api/v1/athlete/{id}/folders/{folderId}/workouts` — create saved workout. Requires `type` (default `"Ride"`) and `folder_id` in the body.
- `PUT /api/v1/athlete/{id}/folders/{folderId}/workouts/{workoutId}` — update saved workout.
- `DELETE` — works on both folders and saved workouts.

## Activities + analysis

- `GET /api/v1/athlete/{id}/activities` — recent activities list (thinner projection than the single-activity endpoint).
- `GET /api/v1/activity/{activityId}` — full detail.
- `GET /api/v1/activity/{activityId}/streams` — time-series streams (`watts`, `heartrate`, `cadence`, etc.). Sparse — confirm null handling live.
- `GET /api/v1/athlete/{id}/power-curves` — power-duration curve.

## Athlete + wellness

- `GET /api/v1/athlete/{id}` — profile, FTP, LTHR, weight, custom items, zones.
- `GET /api/v1/athlete/{id}/wellness` — daily wellness records. Supports `oldest`/`newest`. Subjective fields (fatigue, soreness, motivation, sleep) are **nullable** when not logged that day.

## Documentation links

- **Forum API reference** — https://forum.intervals.icu/t/uploading-planned-workouts-to-intervals-icu/63624 (the most reliable source; the maintainer answers questions there).
- **API docs SPA** — https://intervals.icu/api-docs.html (JS-rendered; won't work via fetch and has drifted from reality in places — verify against live responses).
- **Intervals.icu forum** — https://forum.intervals.icu/ (search for endpoint names; threads often surface undocumented behavior).

## When in doubt

If this index disagrees with what you see on the live account, **the live account wins.** Update this file, don't code around the doc.
