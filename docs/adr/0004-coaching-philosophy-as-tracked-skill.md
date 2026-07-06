# Coaching philosophy is a tracked skill; personal state is a gitignored override

The durable coaching philosophy — pillars, intensity anchor, execution rules, biases, test cadence
— now lives **in git** as the `coaching-philosophy` skill (`.claude/skills/coaching-philosophy/`),
with an operative-core `SKILL.md` and topic subfiles for progressive disclosure. It is the base
layer every install shares. A single athlete personalises it through a thin, **gitignored**
override at `docs/personal/steering.md` that **wins on conflict**; the current block stays in
`docs/personal/season.md`. Facts promote _up_ the stack as they prove durable (coaching
log → season, steering → the philosophy skill, the last being a commit).

This **reverses** the previous model, in which philosophy was either uploaded to a Claude Project
as "Project knowledge" (per the old `setup_coaching` prompt, README, and manifest) or read from a
gitignored `docs/personal/philosophy.md` (per the skills) — two contradictory homes, both leaving
the highest-value asset untracked and per-machine. The `setup_coaching` prompt is repurposed to
bootstrap the personal `season.md` + `steering.md` only; the Project-knowledge upload path and
`docs/project-instructions.md` are retired.

## Relation to ADR 0003

ADR 0003 rejected "a curated local markdown file of athlete context" on the principle that
_athlete state is always fresh, no files to maintain_. That ruling is about **volatile state**
(MAP, zones, CTL/ATL/TSB) — which remains live-derived via `get_coaching_context` and is
deliberately **never** stored in the philosophy skill. Coaching **philosophy** is the opposite:
durable, slow-changing, and valuable precisely _because_ it is versioned. So there is no conflict —
this ADR draws the line between volatile state (live, never filed) and durable philosophy (tracked,
versioned).

## Considered options

- **Keep philosophy as Claude Project knowledge** (upload) — rejected: invisible to the skills that
  actually read it, per-machine, unversioned, and reachable only in the desktop app. Skills are the
  distribution vehicle every install already carries (and skills-embedded-in-MCP is coming).
- **Keep philosophy in gitignored `docs/personal/philosophy.md`** — rejected: leaves the crown-jewel
  IP untracked and unshareable; the value of a philosophy compounds when it is versioned and grows.
- **Make steering powerful enough to wholesale-replace philosophy** (addressable pillar IDs a
  different user could disable) — deferred: over-engineered for now. Steering is additive override;
  a user wanting a fundamentally different philosophy forks the skill.

## Consequences

- The philosophy is authored/edited as a skill and versioned in git; a durable change is a commit,
  and its history is reviewable.
- The `coaching-philosophy` skill carries this athlete's specifics (pursuit biases, MAP anchor);
  other installs override via their own `steering.md` or fork. Genericising the skill is a non-goal.
- Both entry skills (`coaching-session`, `intervals-coach`) read the skill + `steering.md` at
  session-start and must apply steering over philosophy on conflict, saying so.
- Live athlete state stays out of all tracked files — `get_coaching_context` remains the only
  source of FTP/MAP/zones/fitness (ADR 0003 preserved).
