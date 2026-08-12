# intervals-icu-mcp

A server exposing Intervals.icu operations and agentic-coaching tools. The same operations are surfaced through more than one transport, so the vocabulary below separates an operation from the surfaces that project it.

## Language

**Tool**:
A named operation defined once as `{ name, description, input schema, handler, annotations, output schema? }`. Lives in `src/tools/`, registered in `src/registry.ts`.
_Avoid_: command, endpoint, function (for the registered unit)

**Tool registry**:
The single list (`src/registry.ts`) of all Tools, iterated by every Adapter. The source of truth for what operations exist.
_Avoid_: tool list, catalogue

**Adapter**:
A transport that projects the Tool registry onto a surface. Owns transport concerns (wire format, discovery, error rendering); never holds business logic.
_Avoid_: transport, layer (as synonyms for the module)

**MCP adapter**:
The Adapter at `src/mcp/` that projects Tools as Model Context Protocol tools. The production / distribution artifact (mcpb, manifest, desktop).

**CLI adapter**:
The Adapter at `src/cli/` that projects Tools as Bash subcommands. The agent's zero-reconnect dev surface, run via `tsx`.

**Projection**:
A single Tool as exposed by one Adapter. An **MCP tool** and a **CLI command** are two Projections of the same Tool.

**MAP zones**:
The canonical coaching training zones, anchored to MAP (Ric Stern / cyclecoach model). Derived live and surfaced by `get_coaching_context` as `mapZones`. The coaching skills reason in these.
_Avoid_: "power zones" (ambiguous with the FTP set)

**FTP zones**:
Intervals.icu's native Coggan / %FTP power zones. Available on the raw `get_athlete` view; intentionally absent from the coaching context (see ADR 0003).

**Workout template**:
The tracked Markdown file in `templates/` that is the source of truth for one curated workout — frontmatter (identity, folder, purpose, basis) plus a body in Intervals.icu step syntax. Authored by hand; editing one is a commit.
_Avoid_: "seed" or "canonical template" (both imply a one-time initial write, which is exactly what this is not)

**Library workout**:
The materialised copy of a Workout template on Intervals.icu. A **rendered view**, never a source — hand edits to it are overwritten on the next Sync. Every Library workout has a Workout template behind it.
_Avoid_: calling it the workout "in the library" as though it were authoritative

**Sync**:
The single reconcile operation (`sync_workout_library`): render every Workout template at the current anchors and upsert it, matched by its Template marker. Creates what is missing, updates what differs, never deletes.
_Avoid_: "seed" / "refresh" — both named halves of this one operation and are retired

**Basis**:
The anchor a template's percentages are read against — MAP or FTP — declared once per template. One basis per template; mixing is a parse error.

**Anchored target**:
A bare percentage in a step line, resolved against the template's Basis at render time. Everything else — literal watts, zones, HR, pace, cadence — is a **literal target**, emitted verbatim and unaffected by anchor changes. A template with no Anchored target needs no Basis and always syncs.

**Template marker**:
The HTML comment carrying a Workout template's identity on its Library workout, so Sync can find the copy it owns. Invisible in the Intervals.icu UI.

**Orphan**:
A marker-bearing Library workout whose Workout template no longer exists. Reported by Sync as a warning; never deleted automatically.

**Planned step**:
One prescribed step of a workout after repeat blocks have been expanded — the unit of verification. A 3×(12min/4min) block is six Planned steps, each carrying its rep number, so decay across reps is visible. Read from the event's `workout_doc` (Intervals.icu's own parse), never re-parsed from the description text.
_Avoid_: "interval" for the planned side — that is the recorded half (see **Delivered interval**)

**Delivered interval**:
One segment of a completed activity, reduced to duration and average power/cadence/HR. What was actually ridden, as against what a **Planned step** asked for. Where the segment boundaries come from is the **Execution record**.
_Avoid_: "actual step" (there are no steps on the recorded side)

**Execution record**:
Which reading of the ride a comparison drew its **Delivered intervals** from. `device-laps` is the laps the head unit wrote, decoded from the original upload — the faithful record of what the athlete marked. `detected-intervals` is Intervals.icu's `icu_intervals` analysis: derived, editable, and free to re-cut boundaries, used only when laps are unavailable (no FIT file, or a ride that was never lapped) or cannot explain the session. Always reported; a derived reading known to have drifted from the laps carries a note saying so (see ADR 0006).
_Avoid_: treating `icu_intervals` as the recording — it is an interpretation of one; preferring whichever record aligns _better_ (detection re-cuts boundaries to fit, so it scores best exactly where it has invented the structure)

**Alignment basis**:
How a comparison paired **Planned steps** to **Delivered intervals**, always reported so the caller can see how much to trust the pairing: `sequential` (all matched in order, no gaps), `duration` (partial — some steps or intervals unmatched), `none` (declined to pair). Pairing reads duration and position only, never power.
_Avoid_: treating `none` as an error — it is a deliberate refusal, and the roll-up is still returned

**Verdict**:
The per-step judgement of delivery against prescription: `on-target`, `over`, `under`, `not-attempted` (delivered far less time than prescribed), `unmatched` (no interval could be paired). A range target is judged on its own band; a ramp is judged against its midpoint; `tolerance` governs point targets only.
_Avoid_: "compliance" — that is Intervals.icu's own scalar figure, reported alongside but distinct from these Verdicts

**Intensity distribution**:
Time spent at each intensity across a session or window, computed on both sides — the planned side from the prescription's own **Planned steps**, the delivered side from the recorded power stream — and bucketed against one shared frame. The frame is a partition _derived_ from the athlete's **MAP zones**, whose bands deliberately overlap and so cannot be bucketed into directly: each wattage is assigned to the highest zone whose floor it reaches. Every result reports the boundaries it used.
_Avoid_: reading either side off Intervals.icu's `workout_doc.zoneTimes` or `icu_zone_times` (authoring-time and upload-time snapshots, independently anchored, not the prescription); quoting a partition band as though it were the coaching band of the same name (the partition's L3 is narrower).

**Middle-band dose**:
Seconds in the 76–106% FTP window — tempo through threshold — the coaching philosophy's primary judge of a build week. Computed from its own bounds, never by summing whichever zones approximate it, and reported alongside the per-zone breakdown rather than derived from it. On the planned side a prescribed range contributes the share of its width that lies inside the window, not all-or-nothing by midpoint.
_Avoid_: treating it as a roll-up of the zone breakdown (the two are anchored on FTP and MAP respectively, and neither derives from the other); calling a session "delivered" on duration when its middle-band dose fell short.

**Review window / watermark**:
The span an execution review sweeps, running from the `reviewed-through` date in the coaching log's live-state header to today. Advanced to today only as part of a confirmed log write, so an unconfirmed session leaves the window intact. Capped at 28 days (the block cadence); skipped when the window holds no key session.
_Avoid_: "since last time" or any window derived from conversation history rather than the watermark — the watermark is what makes the review neither re-review nor silently skip.

**Work step vs support step**:
Whether a **Planned step** carries the session's prescribed intent (work) or serves it (warm-up, recovery, cool-down). **Derived in the coaching layer, not reported by any tool** — no marker exists on the planned side and the delivered `type` field is auto-detected and unreliable. Derived from prescribed intensity relative to the **MAP zones** together with structural position, both signals agreeing; where they disagree the role is stated as uncertain.
_Avoid_: reporting a **Verdict** on a support step as a finding — `under` on a recovery step means recovery was taken as easily as prescribed, which is the session working.

**Lap-split record**:
An external timing app's export of a track session: one row per timed lap, giving the run it belongs to, cumulative distance, cumulative time and lap time. Self-verifiable — lap times sum to the cumulative column and distance advances by the lap length — and so checked against itself before anything is fitted to it. It is the measurement of _what happened_; the activity's streams are the measurement of _what it cost_. Neither file references the other, which is the whole problem the alignment solves.
_Avoid_: trusting the export's own "Average Speed" and "Average Cadence" columns — they are unweighted means of the lap values, not distance ÷ time.

**Candidate window**:
A stretch of the activity where cadence stays near the session's own peak, long enough to hold a scored run. Every alignment search is confined to one, and each run claims exactly one, in order. Not an optimisation: an unconstrained search over the whole ride returns a low residual and an absurd development from easy riding, because near-constant cadence fits any near-constant speed profile once the scale is free.

**Offset interval**:
The span of start offsets whose cadence fit is as good as the best, reported for every run. The objective is flat near its minimum — ±1 s moves it by 1–3% — so a single offset would overstate how precisely the run is placed. Every reading is re-taken at the interval's edges, and the spread travels with it as the reading's **band**.
_Avoid_: reading a band as a statistical error bar — it says how much the number moves if the run sits where it plausibly could, nothing about instrument noise.

**Alignment verdict**:
How well a run's cadence fit placed it: `strong`, `marginal`, `weak`, or `ambiguous` (a distinct offset fits nearly as well). Judged against thresholds the result publishes alongside it. A `weak` or `ambiguous` run keeps its run-level readings — which the band shows to be robust — and has its per-lap readings **withheld**, because lap boundaries that are not placed are exactly the plausible fiction the tool exists to avoid.
_Avoid_: confusing it with a **Verdict**, which judges delivery against prescription; this one judges a measurement's own alignment and says nothing about the athlete.

**Fitted development**:
Metres of assumed lap distance per crank revolution, recovered by the alignment rather than supplied to it. Equals the drivetrain's true development only if the rider covered exactly the assumed lap distance, so a figure below the known gear is evidence about the line ridden. Agreement across a session's runs is independent evidence the alignment is right.
_Avoid_: expressing it in gear inches — that conversion assumes a 27" wheel and lands ~2.9% low (see `docs/personal/track-context.md` §1).

**Coaching philosophy**:
The athlete's durable, timeless training principles — foundational pillars, intensity anchor (MAP), execution rules, biases, test cadence. **Tracked in git** as the `coaching-philosophy` skill and shared by every install; the base layer of the Coaching-context stack. Editing it is a commit (see ADR 0004).
_Avoid_: putting season-scoped or current-state facts here (those are **Season** / athlete state); calling one athlete's deviations "philosophy" (that's **Steering**).

**Steering**:
A single athlete's thin, personal override layer (`docs/personal/steering.md`, gitignored) on top of the shared **Coaching philosophy**. **Wins on conflict.** Durable steering is promoted _up_ into the philosophy skill.
_Avoid_: durable training beliefs that would hold next season (promote them into philosophy); block-scoped plans (that's **Season**).

**Season**:
Personal, gitignored current-block context (`docs/personal/season.md`) — race calendar, macro structure, block constraints. Revised between blocks.
_Avoid_: momentary CTL/TSB and in-flight niggles (that's the coaching log); timeless principles (that's **Coaching philosophy**).

**Coaching-context stack**:
The four ordered tiers the coaching skills read at session-start, most-durable first: **Coaching philosophy** → **Steering** → **Season** → coaching log. Later tiers override earlier ones on conflict; facts promote _up_ the stack as they prove durable (log→season, steering→philosophy).
_Avoid_: confusing this with `get_coaching_context`'s output — that is live **athlete state** (FTP/MAP/zones/CTL), a separate input, not a tier in the stack.

## Relationships

- A **Tool** is registered once in the **Tool registry**
- Each **Adapter** iterates the **Tool registry** and produces one **Projection** per Tool
- An **MCP tool** and a **CLI command** are **Projections** of the same **Tool**
- An **Adapter** holds no business logic — that lives in the Tool's handler and the services it calls
- A **Workout template** is rendered by **Sync** into exactly one **Library workout**, found by its **Template marker**
- A **Library workout** with no **Workout template** is an **Orphan**; a **Workout template** with no **Library workout** is created on the next **Sync**
- An **Anchored target** moves when MAP/FTP moves; a **literal target** does not — that is the whole difference between them
- A **Planned step** is paired to at most one **Delivered interval**; the pairing's **Alignment basis** says how it was reached, and each pair yields one **Verdict**
- **Delivered intervals** come from exactly one **Execution record**, tried best-first and never mixed: the laps are preferred, and lose only when they align to nothing at all
- A **Planned step** with no pair, and a **Delivered interval** with no pair, are both reported rather than dropped — the latter as unplanned work
- **The prescription is the contract both lenses judge against.** Because workouts are authored in absolute watts, neither the **Verdict** nor the **Intensity distribution** moves when FTP or MAP moves between prescribing and riding
- The two lenses answer different questions and **neither subsumes the other**: **Verdicts** say what happened _within_ the reps and need an **Alignment basis** better than `none`; the **Intensity distribution** says how much of the prescribed dose landed and needs no pairing at all, so it still reports where the step lens refuses
- Per-zone seconds of an **Intensity distribution** sum to its total, because the frame is a partition; the **Middle-band dose** does not participate in that sum, being a separate window over the same seconds
- Delivered seconds sum to the activity's **recording** time, not its elapsed time — paused time belongs to no zone
- A **Lap-split record** is joined to an activity by fitting cadence inside a **Candidate window**; each run claims one window, one-to-one and in order, so two runs of the same distance can never resolve to the same stretch
- An **Alignment verdict** governs what is returned, not just what is labelled: `weak` and `ambiguous` withhold per-lap readings while keeping run-level ones
- Every aligned reading carries a band derived from the **Offset interval**, so alignment uncertainty is stated in the unit the reader reasons in rather than in rpm
- A **Work step vs support step** classification is never returned by a Tool; it is derived where **Verdicts** are read, so that an inference about coaching intent never travels as though it were data

## Example dialogue

> **Dev:** "If I add a `get_segments` operation, do I wire it into both the server and the CLI?"
> **Architect:** "No — you add one **Tool** to the **Tool registry**. Both **Adapters** pick it up, so you get an MCP tool and a CLI command for free. You only touch an **Adapter** if the _transport_ needs something special."

## Flagged ambiguities

- "verdict" was used for two unrelated judgements — resolved: a **Verdict** judges delivery against prescription, an **Alignment verdict** judges how well a measurement was placed. They travel in different results and neither implies the other; a run can be ridden exactly to prescription and still align `weak`.
- "tool" was used for both the registered operation and its MCP form — resolved: the registered unit is a **Tool**; its MCP-surface form is an **MCP tool** (a **Projection**), and its CLI-surface form is a **CLI command**.
