---
name: eval-case
description: Build a new skill-eval case with the athlete — pick a real moment, interview for ground truth, capture, write graders, calibrate.
disable-model-invocation: true
---

# eval-case

Builds one skill-eval case in `docs/personal/evals/scenarios/<skill>/<id>/`. The commands and their
flags are in `docs/evals.md`, "Adding a new case"; this skill adds the judgement around them.

The athlete is the **ground truth**. Every verdict in the case is the athlete's — what good coaching
does here, what a bad run looks like. Yours are data facts: what the recording and the plan files
say. A case built on your own verdicts grades the model against itself.

A **paid step** runs the agent (`eval:capture --record`, `eval:skills`, `--record-missing`,
`eval:grade --judge`). Before each one, state the command and its likely cost and wait for the
athlete's yes.

## 1. Find the gap

Run `npm run eval:cases` and read the `case.yaml` of every case for the target skill. Name what the
suite lacks for that skill — a situation type (typical, edge, or a **negative** case where the right
answer is to push back or write nothing), a skill branch no case reaches, or a failure the athlete
has seen in real use.

Done when you and the athlete agree on the gap in one sentence.

## 2. Pick the moment

Read `docs/personal/coaching-log.md` and `docs/personal/season.md` for real dated moments that fit
the gap. Offer two or three, each with its date and what happened. The athlete picks one, or names
another.

Then fix, with the athlete:

- **skill** and **id** — ids follow the skill's prefix (`er-`, `pw-`) and name the situation
  (`pw-midweek-cap`).
- **scenario date** — "today" for the run: the day the athlete would have asked. The case's personal
  files hold only what was known on that date.
- **prompt** — in the athlete's own words, as they would have typed it that day.

Done when all four are fixed.

## 3. Interview for the ground truth

Ask one question at a time until the athlete has said:

- what a good run does, concretely (which sessions it reports or holds; what it writes, on which
  date, to which event; the intent's watts and time)
- the **bad run** — what a plausible model would actually do wrong here. The graders must catch it.
- which plan files justify it (a steering rule, a season line, a log entry)

Offer data facts freely ("the 6 Aug reps averaged 88/85/82/80 rpm"). Where the athlete is unsure,
the case waits — an expectation nobody stands behind makes a flaky case.

Done when every expectation traces to something the athlete said or to recorded data.

## 4. Capture and record (paid step)

Run `eval:capture` with `--record`, the step-2 values, and a `--description` naming the moment and
what a good run does. Read the capture notes: if the personal history did not reach back to the
date, edit the case's `personal/` files back to the scenario date with the athlete.

Done when `case.yaml`, `personal/` and `cassette/` exist and `eval:cases` shows the cassette.

## 5. Write the graders

Turn each expectation into a grader in `case.yaml`, using the options in `docs/evals.md`, "Grader
reference":

- **Deterministic first.** Writes, dates, event ids, watt bands, time caps, required terms — each
  gets a code grader. Take exact values from the cassette: event ids and existing sessions from the
  `events` entries, FTP and zones from the athlete record, delivered rep figures from the activity
  entries. Work out bands from the athlete's stated intent (88–95% of the recorded FTP → watts).
- **`llmRubric` only for judgement** — framing, reasoning, whether it pushed back for the right
  reason. Write criteria as explicit `PASS if all of these hold:` / `FAIL if` lists that name the
  case's own dates and numbers.
- A comment above the graders records the ground truth and its source (the athlete, the date, which
  data), so the case can be adjusted later without redoing the interview.

Then prove the bad run is caught: write its writes as `bad-writes.jsonl` (one
`{"method", "path", "body"}` per line, shaped like a real capture) and, if its failure is in the
reply, its reply as `bad-final.md`, both in the scratchpad. Run
`npm run eval:grade -- --case <id> --writes <bad-writes.jsonl> [--final <bad-final.md>]`.

Done when every expectation from step 3 maps to a grader, no `TODO` remains, and `eval:grade`
reports the bad run FAILS on at least one deterministic grader.

## 6. Calibrate (paid step)

Run a replay trial or two at `claude-sonnet-5` / `low`. For each trial, show the athlete the reply
(`final.md`) and the captured writes, and ask: would you accept this? Set their verdict beside the
graders'. The case is **calibrated** when they agree on every trial:

- athlete accepts, a grader fails → the grader is too tight, or the expectation was wrong; fix
  whichever the athlete says
- athlete rejects, everything passes → a grader is missing or too loose; add or tighten one
- `noReplayMisses` fails → top up with `--record-missing`, then re-run

After any grader edit, re-grade the stored trials with `eval:grade --run <runDir>` and the bad run
with `eval:grade --writes` — both free — rather than running new trials.

Done when calibrated, the bad run still FAILS, and `noReplayMisses` passes.

## 7. Commit

Commit the case directory in the private `docs/personal` repo.
