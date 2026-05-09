---
name: intervals-api-research
description: Verify Intervals.icu request/response shapes against live data before designing or implementing API-surface changes. Use whenever you add or modify an endpoint wrapper, parse a new response field, debug an Intervals.icu API call, design a new MCP tool that hits Intervals.icu, or are about to write a TypeScript type for an Intervals.icu payload.
---

# intervals-api-research

The Intervals.icu API surface is large, partly undocumented, and changes without notice. Inventing shapes from memory has caused repeated rework. This skill enforces the rule: **probe live before typing.**

## The rule

Before you write a type, parser, or request body for an Intervals.icu endpoint, look at a real response. Do not type from memory. Do not extrapolate from one endpoint's shape to another's.

This applies to:

- Adding a new tool/service that wraps a new endpoint.
- Adding a new field to an existing parser (the field you assume exists may not, or may have a different name/case).
- Changing a request body (query params, JSON shape, upsert keys).
- Debugging when behavior contradicts your mental model — your model is the suspect.

## Decision tree

```
About to touch Intervals.icu API surface
    │
    ▼
Is the endpoint already wrapped by an MCP tool?
    │
    ├── Yes → Call the MCP tool (mcp__intervals-icu__*) with realistic args.
    │         Inspect the JSON. Note nullable fields, casing, array vs. object.
    │
    └── No  → Probe directly. Pick the lightest:
                ├── One-shot curl with $INTERVALS_API_KEY  (5-second check)
                ├── scripts/probe-*.mjs (dotenv + fetch, mirrors scripts/exercise-*.mjs)
                └── HttpClient import for auth + rate-limit handling
              See live-probing.md for templates.
```

After probing, paste the real response (trimmed) into the PR description or commit body so the next person can audit the shape you coded against.

## What you must not do

- Do **not** define types from the API docs page (`intervals.icu/api-docs.html`) without confirming live — the docs are an SPA reference and have drifted from reality in practice.
- Do **not** copy a shape from one endpoint to another. Sibling endpoints frequently disagree on field names, casing, and nullability.
- Do **not** write a parser for "the field that's probably there" — confirm it's there, in the case you expect, on a real account.
- Do **not** assume empty/missing means the same thing. Some endpoints return `null`, some `[]`, some omit the key entirely.

## Reference files

- [live-probing.md](live-probing.md) — concrete probe patterns (curl one-shot, `scripts/` template, HttpClient import).
- [endpoint-reference.md](endpoint-reference.md) — index of known endpoints + quirks + doc links. Use as a pointer; always confirm against a live response.

## When the user is the source of truth

The connected athlete's account _is_ the live data. When in doubt about a shape, ask the user for permission to call a read-only tool against their account, or ask them to paste a sample response from the Intervals.icu UI's network tab. Real beats remembered every time.
