# Skill evals: a custom Agent SDK runner over recorded scenarios

The coaching skills (`execution-review`, `plan-workout` → `compose-workout`, …) are prompts, and
nothing checked how they behave. We want to score them on realistic moments from the athlete's own
history, sweep **models × effort levels**, and judge a new model against a stored baseline before
switching to it. Issue #20 holds the full design; this records the decisions that shape the code.

## A custom runner on the Agent SDK, not `claude plugin eval`

`claude plugin eval` has no effort flag and no code graders, and its empty-workspace isolation
strips exactly what the skills depend on: the project `.claude/` agents, `docs/personal` and the
`bin/icu` setup. The runner (`evals/skills/run.ts`) instead drives `@anthropic-ai/claude-agent-sdk`
in a throwaway copy of the working tree, with `settingSources: ["project"]` so project skills load
and user-level config does not leak in. Copying the working tree means uncommitted skill edits are
what gets tested — the point of running an eval while editing a skill.

The forked skills' agent definitions pin `model: sonnet`, which would hide the model under test.
The workspace copy rewrites them to `inherit` by default (`--subagent-model pinned` keeps them).

## Replay goes in the CLI

The skills reach Intervals.icu only through `./bin/icu`, so that is the one seam. `src/cassette.ts`
wraps the `HttpClient`'s injectable fetch: `ICU_RECORD_DIR` saves each GET into a cassette,
`ICU_REPLAY_DIR` answers GETs from it and logs misses, and `ICU_RECORD_MISSING` tops a cassette up.
**Writes are never sent in any mode** — they are appended to `ICU_CAPTURE_FILE` and answered with a
synthetic success, so a skill that writes a workout behaves normally and the grader reads the
request it would have made. Recording is therefore safe to run against the live account.

`ICU_NOW` pins "today" through the client facade, and the runner states the scenario date to the
agent, so a replayed scenario is internally consistent. With none of these set, `bin/icu` is
unchanged.

## Deterministic graders first, a judge only for judgement

Graders are TypeScript functions over the transcript, the captured writes and the replay misses.
Anything checkable is checked in code — which skill ran, which writes were made, whether the
written workout parses, whether its work steps sit in the intended watt band. A pinned judge model
(majority of three) covers only the qualitative criteria. `plan-workout`'s 2×20 failure moved from
a judge call to `targetsInBand` for this reason: a code grader cannot be talked round.

`oneWorkoutWritten` and `libraryDecision`, listed in the issue, did not become graders of their own:
the `writes` grader states the exact calendar writes a run should make, and whether the library was
used is judged by the rubric.

## Scenarios are private; the runner is public

Scenarios carry the athlete's steering, season, coaching log and recorded platform data, so they
live in the private `docs/personal/evals/` (its own repo), along with results. The runner,
graders, capture and compare tools live here. Nothing under `evals/skills` runs in `npm test`,
the husky hook or the release: every trial and judge call costs money, so evals are run by hand,
under a cost ceiling.

## Consequences

- The eval dependencies (`evals/skills/package.json`) stay out of the server's dependency tree.
- A skill that reaches Intervals.icu other than through `bin/icu` would escape replay.
- Claude Code's own system prompt carries the real date; the appended scenario date and `ICU_NOW`
  dominate in practice, and the date-bearing graders would show it if they stopped doing so.
- A cassette is a point-in-time recording. A model that asks for data the recording lacks gets a
  replay miss (reported, never scored); `--record-missing` fills the gap from the live account,
  which for a past scenario date is still the same history.
