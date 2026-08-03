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
One recorded lap of a completed activity (`icu_intervals`), reduced to duration and average power/cadence/HR. What was actually ridden, as against what a **Planned step** asked for.
_Avoid_: "lap" (Intervals.icu's own term is interval); "actual step" (there are no steps on the recorded side)

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
- A **Planned step** with no pair, and a **Delivered interval** with no pair, are both reported rather than dropped — the latter as unplanned work
- **The prescription is the contract both lenses judge against.** Because workouts are authored in absolute watts, neither the **Verdict** nor the **Intensity distribution** moves when FTP or MAP moves between prescribing and riding
- The two lenses answer different questions and **neither subsumes the other**: **Verdicts** say what happened _within_ the reps and need an **Alignment basis** better than `none`; the **Intensity distribution** says how much of the prescribed dose landed and needs no pairing at all, so it still reports where the step lens refuses
- Per-zone seconds of an **Intensity distribution** sum to its total, because the frame is a partition; the **Middle-band dose** does not participate in that sum, being a separate window over the same seconds
- Delivered seconds sum to the activity's **recording** time, not its elapsed time — paused time belongs to no zone
- A **Work step vs support step** classification is never returned by a Tool; it is derived where **Verdicts** are read, so that an inference about coaching intent never travels as though it were data

## Example dialogue

> **Dev:** "If I add a `get_segments` operation, do I wire it into both the server and the CLI?"
> **Architect:** "No — you add one **Tool** to the **Tool registry**. Both **Adapters** pick it up, so you get an MCP tool and a CLI command for free. You only touch an **Adapter** if the _transport_ needs something special."

## Flagged ambiguities

- "tool" was used for both the registered operation and its MCP form — resolved: the registered unit is a **Tool**; its MCP-surface form is an **MCP tool** (a **Projection**), and its CLI-surface form is a **CLI command**.
