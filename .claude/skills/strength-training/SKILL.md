---
name: strength-training
description: Compose and schedule a gym / strength session on Intervals.icu, and reason about how strength supports the bike. Encodes the Combined Athletic Performance (Chris Peden, @chr1speden — S&C coach, Decathlon CMA CGM WorldTour) method for endurance athletes: minimum effective dose, stimulus-to-fatigue ratio, force–velocity/RFD, exercise selection by season phase. Use when the user asks to plan, build, schedule, or review a gym / strength / lifting / S&C session, mentions squats/deadlifts/step-ups/jumps, asks how many gym sessions to run, or how strength transfers to the standing start or the pursuit.
---

# strength-training

Strength-and-conditioning skill for the `intervals-icu-mcp` server. Composes gym sessions and
schedules them as `WeightTraining` events via **`create_strength_workout`**. It is the strength
sibling of `intervals-coach` (which handles bike/run workouts).

The method here is distilled from **Chris Peden (@chr1speden)** — S&C coach for the Decathlon CMA
CGM WorldTour team, owner of Combined Athletic Performance — whose whole message is: strength
_serves_ the endurance goal, and the coach's real job is deciding what **not** to prescribe. It is
the operational "how"; the durable "why" lives in the `coaching-philosophy` skill's
[strength pillar](../coaching-philosophy/strength.md).

## Session-start moves (always)

Before composing a gym session, do these in parallel:

1. **`get_coaching_context`** — today's CTL/ATL/TSB, ramp rate, readiness, and the 7-day wellness
   trend. Gym load is layered on top of an already-fatigued system; readiness gates volume. Don't
   ask the athlete for fitness — read it.
2. **Read `docs/personal/season.md`** — the **current block** sets strength **frequency and intent**
   (build/reload vs maintain). Also read `docs/personal/steering.md` (overrides win on conflict).
   The philosophy's [strength pillar](../coaching-philosophy/strength.md) and the execution rules in
   `.claude/skills/coaching-philosophy/SKILL.md` are the hard constraints.
3. **Know the week's hard bike/track days** (ask, or `get_events`) — placement matters as much as
   content (see Constraints).

## Decision tree

```
User wants a gym session / strength plan
    │
    ▼
get_coaching_context  +  read season.md / steering.md      (parallel)
    │
    ▼
What block are we in?  →  frequency (×/week) + intent      → periodization.md
    │                      (build · reload · maintain · sharpen)
    ▼
Readiness OK + which bike days are hard this week?
    │
    ▼
Pick a template for the phase                              → sessions.md
    │   choose exercises by stimulus-to-fatigue ratio      → exercises.md
    │   auto-regulate load by RPE / bar velocity (never fixed kg)
    ▼
Place it right (stack on a hard ride day; never before track;
    never a HI bike day after heavy lifting)
    │
    ▼
create_strength_workout   (name, date, description = exercises · sets×reps · RPE)
```

## The five principles (the lens for every decision)

One line each; the reasoning and the source posts are in [principles.md](principles.md).

1. **Strength serves the bike.** Aerobic work is always the higher priority; strength and fitness
   are built _together_, never traded off.
2. **Minimum effective dose.** As much as necessary, not as much as possible. Heavy, sore legs are a
   programming error, not a badge. Ask "what can I _remove_?" before "what can I add?"
3. **Train both ends of the force–velocity curve.** Heavy builds the force ceiling; speed/jumps
   train how fast you reach it (rate of force development). Power needs both.
4. **Pick exercises by stimulus-to-fatigue ratio, for the phase you're in.** Multi-joint over
   isolation, stable over unstable, specificity over novelty. → [exercises.md](exercises.md)
5. **Individualise; be evidence-informed, not evidence-blind.** No fixed template — decide for the
   athlete and the moment in the season.

## Constraints (respect the coaching-philosophy execution rules)

- **Frequency is set by the block** — read it from `season.md`. **Never exceed 2×/week.**
- **Auto-regulate load by RPE / bar velocity**, never prescribe absolute kg — the athlete's gym
  numbers are not in `get_coaching_context`, and Peden's method is intent-and-velocity led anyway.
- **Placement:** stack strength on a **hard ride day** (ride AM / gym PM, a few hours apart) so easy
  days stay truly easy. **No high-intensity bike day _after_ heavy lifting. Never a fatiguing gym
  day the day before a track session.** Two-a-days only on weekends / WFH days.
- **The bike is the priority.** If a session would compromise the quality of a key ride or track
  session, cut it or lighten it — that is the whole point of the method.

## The pursuit application

This athlete is a masters **2 km IP / 4 km TP** rider whose **standing start** regressed this season
(strength supports the gate; note the 165 mm-crank leverage confound). That makes **maximal force +
rate of force development from a dead stop** the headline strength target — heavy low-rep bilateral
work, loaded jumps, and dead-stop/accelerative lifts. How this shifts across the Re-build →
Specific Prep III → Pre-Competition blocks is in [periodization.md](periodization.md); ready-to-run
sessions for each are in [sessions.md](sessions.md).

## Provenance

Source: ~100 posts from @chr1speden downloaded to `docs/personal/instagram/chr1speden/` (gitignored)
and distilled here. This is one experienced practitioner's evidence-informed method, not a
peer-reviewed protocol — treat it as a strong, coherent coaching lens, and let the athlete's own
response and the `coaching-philosophy` skill arbitrate on conflict.
