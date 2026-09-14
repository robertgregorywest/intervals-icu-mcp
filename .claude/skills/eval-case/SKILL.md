---
name: eval-case
description: Build a new skill-eval case with the athlete — pick a real moment, interview for ground truth, capture, write graders, calibrate.
disable-model-invocation: true
---

# eval-case

Builds one skill-eval case in `docs/personal/evals/scenarios/<skill>/<id>/`. The mechanics
(capture, record, replay, grader options) are in `docs/evals.md` — read its "Adding a new case" and
"Grader reference" sections before step 4.

The athlete is the **ground truth**. Your job is to translate what they say good coaching looks
like into graders, and to pull the facts that make those graders exact from the recorded data. When
a question is about what the coach _should_ do, ask it and record the answer; the case must never
encode your own view of good coaching, or it grades the model against itself.

Every run of `eval:skills` or `eval:capture --record` spends money. State the command and its
likely cost, and get a yes before each one.

## 1. Find the gap

Run `npm run eval:cases` and read the `case.yaml` of any case in the target skill. Name what the
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
  files are the world as of this date; nothing later belongs in them.
- **prompt** — in the athlete's own words, as they would have typed it that day.

Done when all four are fixed.

## 3. Interview for the ground truth

Ask one question at a time until the athlete has said:

- what a good run does, concretely (which sessions it reports or holds; what it writes, on which
  date, to which event; the intent's watts and time)
- what a bad run does that a plausible model would actually do — this is what the graders must
  catch
- which plan files justify it (a steering rule, a season line, a log entry)

Offer data facts freely ("the 6 Aug reps averaged 88/85/82/80 rpm"); offer no verdicts. Where the
athlete is unsure, the case waits — an expectation nobody stands behind makes a flaky case.

Done when every expectation traces to something the athlete said or to recorded data.

## 4. Capture and record

With the athlete's yes:

```sh
npm run eval:capture -- --skill <skill> --id <id> --date <scenario date> \
  --prompt "<prompt>" --description "<the moment, and what a good run does>" --tags <tags> --record
```

Read the capture notes. If the personal history did not reach back to the date, edit the case's
`personal/` files back to the scenario date with the athlete.

Done when `case.yaml`, `personal/` and `cassette/` exist and `eval:cases` shows the cassette.

## 5. Write the graders

Turn each expectation into a grader in `case.yaml`, per the grader reference in `docs/evals.md`:

- **Deterministic first.** Writes, dates, event ids, watt bands, time caps, required terms — each
  gets a code grader. Take exact values from the cassette: event ids and existing sessions from the
  `events` entries, FTP and zones from the athlete record, delivered rep figures from the activity
  entries. Work out bands from the athlete's stated intent (88–95% of the recorded FTP → watts).
- **`llmRubric` only for judgement** — framing, reasoning, whether it pushed back for the right
  reason. Write criteria as explicit `PASS if all of these hold:` / `FAIL if` lists that name the
  case's own dates and numbers.
- **The bad run from step 3 fails at least one scored grader**, preferably a deterministic one.
- A comment above the graders records the ground truth and its source (the athlete, the date, which
  data), so the case can be adjusted later without redoing the interview.
- Replace every `TODO` from the skeleton.

Done when every expectation from step 3 maps to a grader and no `TODO` remains.

## 6. Calibrate

With the athlete's yes, run a replay trial or two:

```sh
npm run eval:skills -- --case <id> --models claude-sonnet-5 --effort low --trials 2
```

For each trial, show the athlete the reply (`final.md`) and the captured writes, and ask: would you
accept this? Then set their verdict beside the graders' verdict. The case is **calibrated** when they
agree on every trial:

- athlete accepts, a grader fails → the grader is too tight, or the expectation was wrong; fix
  whichever the athlete says
- athlete rejects, everything passes → a grader is missing or too loose; add or tighten one
- `noReplayMisses` fails → top up with `--record-missing` (with a yes), then re-run

If every trial happens to pass, check the bad run from step 3 is still caught by reading the grader
logic against it — a case that no run can fail measures nothing.

Done when calibrated and `noReplayMisses` passes.

## 7. Commit

```sh
git -C docs/personal add evals/scenarios/<skill>/<id>
git -C docs/personal commit -m "evals: add <id>"
```

Scenarios live only in the private repo; the public repo's `git status` stays clean of them.
