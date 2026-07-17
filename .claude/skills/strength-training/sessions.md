# Session templates — ready to schedule

Concrete gym sessions per season block, built from [exercises.md](exercises.md) and
[periodization.md](periodization.md). Schedule with **`create_strength_workout`** (name, date,
`description`). **Loads are RPE / velocity auto-regulated — never fixed kg.** Adapt the pick to the
athlete's readiness, limiters, and equipment; these are starting points, not a fixed programme.

Every session: **6–8 min general warm-up + ramp-up sets** on the first heavy lift; **maximal
accelerative intent on every concentric**; stop power/jump sets when velocity drops.

---

## Re-build block (late Jun → early Aug, 2×/week)

Two complementary sessions in the week. Reload the base + re-establish gate power. Place both on/near
the weekend quality days (stack on a hard ride, gym in the PM).

### A1 — Force-biased (the "ceiling" day)

```
Trap-Bar Deadlift    4×4   @ RPE 7-8   (accelerate every rep)
Box Squat            3×4   @ RPE 7     (pause on box, drive up fast)
Romanian Deadlift    3×6   @ RPE 7     (pure hip hinge, posterior chain)
Seated Good Morning  2×8   @ RPE 6-7   (stiff trunk + hip extension)
Loaded Jump Squat    3×4   fast        (submax load, max height)
```

`create_strength_workout`:

- name: `Strength A — Force (Re-build)`
- description: the five lines above, `\n`-separated.

### A2 — Single-leg / power-biased (the "specificity" day)

```
Bulgarian Split Squat   3×6 each leg  @ RPE 7   (contralateral load if able)
Step-Up                 3×5 each leg  @ RPE 6-7 (close to box, rise on rear toe)
Trap-Bar Jump           3×4           fast      (dead-stop, explode)
Single-Leg Leg Press    2×8 each leg  @ RPE 7   (heavy limb force, low balance tax)
Loaded Carry / Pallof   2 sets                  (anti-flexion/rotation trunk)
```

`create_strength_workout`:

- name: `Strength B — Single-leg + Power (Re-build)`
- description: the five lines above.

---

## Specific Prep III (Aug, 1×/week) — template B

Maintenance, biased to pursuit force + RFD. One full-body session. Apply the rule of three: reduced
ROM, low volume, load moved fast.

```
Box Squat            3×3   @ RPE 8   (dead-stop, explosive — standing-start specific)
Romanian Deadlift    2×5   @ RPE 7   (posterior chain, don't grind)
Step-Up              2×5 each leg @ RPE 7   (single-leg force, adjustable height)
Loaded Jump Squat    4×3   fast      (RFD / fast-twitch, low fatigue)
```

`create_strength_workout`:

- name: `Strength — Maintain (Specific Prep)`
- description: the four lines above.

---

## Pre-Competition II (Sep → early Oct, 1×/week) — template C

Sharpen into Worlds. Protect the taper: **power/RFD dominant, minimal fatigue, zero soreness.** Keep
the nervous system sharp without buying recovery debt.

```
Trap-Bar Jump        4×3   fast      (primary — max intent, full recovery between sets)
Dead-Stop Step-Up    3×3 each leg @ RPE 7   (accelerate from pause)
Trap-Bar Deadlift    2×2   @ RPE 7   (crisp heavy singles/doubles, well short of failure)
```

`create_strength_workout`:

- name: `Strength — Sharpen (Pre-Comp)`
- description: the three lines above.

**Race week / Competition (Oct):** trim to just the jumps as a neuromuscular primer 2–3 days out —
`Trap-Bar Jump 3×3 fast`. Nothing that leaves a trace of fatigue.

---

## Scheduling notes

- **Ask which bike/track days are hard this week** (or `get_events`) before picking a date — placement
  is a hard constraint (stack on a hard ride; never before track; no HI bike day after heavy lifting).
- **Auto-regulate on the day:** if readiness/HRV is down (check `get_coaching_context`), cut the last
  set of each exercise or drop RPE by a point. A build week that isn't delivered isn't a safe week,
  but a session that wrecks tomorrow's key ride is worse — the bike is the priority.
- **Recovery weeks:** halve the sets or skip the second Re-build session.
- **`externalId`** the event (e.g. `strength-2026-08-05`) so re-scheduling upserts rather than
  duplicates.
