// Single source of truth for the Intervals.icu workout-text syntax,
// embedded into the MCP server `instructions` field at startup.
// CLAUDE.md links here so the docs and the server cannot drift.

export const WORKOUT_SYNTAX_DOC = `## Workout text syntax

Used in event \`description\` and saved-workout \`description\` fields. Lines starting with \`- \` are steps; \`Nx\` introduces a repeat block whose following \`- \` lines belong to it (until a blank line); free text outside step lines renders as workout notes.

\`\`\`
- [label] [duration] [target] [cadence]      # simple step
- [label] [duration] ramp [target] [cadence] # ramp step
Nx                                            # repeat block (blank lines around)
- step
- step
\`\`\`

- **Duration**: \`5m\`, \`30s\`, \`1h2m30s\`, \`2km\`, \`500mtr\` (\`m\` = minutes, \`mtr\` = meters)
- **Power**: \`75%\`, \`95-105%\`, \`220w\`, \`160w-256w\`, \`Z2\`
- **HR**: \`70% HR\`, \`Z2 HR\`, \`95% LTHR\`
- **Pace**: \`60% Pace\`, \`Z2 Pace\`, \`5:00/km Pace\`
- **Cadence**: \`90rpm\`

**Head-unit granularity**: a long/wide \`ramp\` (or wide-range) step collapses to a single average wattage on head units. Split ramps/progressions into steps of **≤ 2 min** and **≤ ~8% MAP (~25–30 W)** range each so the on-screen target steps upward. Steady-state target bands (e.g. a Z2 endurance block) are deliberate and stay as one step.

**Step labels are plain text only**: keep \`number+unit\` tokens (\`60s\`, \`1m\`, \`220w\`, \`90rpm\`, \`75%\`) out of a step's label. On the text round-trip the parser reads the first such token in the line as the step's duration/target, so a label like \`Ramp — MAP = best 60s\` silently turns a 1-min step into a 2-min one and truncates the label. Put numeric detail in the workout's prose notes, not the step label.
`;

export const WATTS_AT_API_RULE = `## Power targets at the API boundary

Reason about intensity in %MAP or %FTP per the coaching context, but **emit absolute watts** (e.g. \`220w\`, \`160w-256w\`) when calling \`create_workout\` or any other tool that writes to Intervals.icu. Intervals.icu's parser does not understand \`%MAP\`. \`%FTP\` is supported but couples the workout to whatever FTP is on file, which may not match the user's intent. Convert at the boundary, not in the user's library.
`;

export const TOOL_INVENTORY = `## Tool inventory (high-level)

- **Library — browse** — \`list_workout_library\`, \`get_workout_library_item\`: browse the athlete's curated workouts. Use this **before composing an ad-hoc workout**, and pick by each entry's \`purpose\` — it says what the workout is *for*.
- **Library — sync** — \`sync_workout_library\`: render every tracked Workout template at the current MAP/FTP and upsert it. The template files in \`templates/\` are the source of truth; the Intervals.icu library is a rendered view. Run it after editing a template and after a new test result. Adding a workout to the library means **writing a template file**, not calling a tool — there is no tool that writes an unmanaged library item, because anything without a template would silently go stale at an old anchor.
- **Workouts** — \`create_workout\`, \`create_strength_workout\`: schedule structured sessions on the calendar.
- **Events** — \`get_events\`, \`get_event\`, \`update_event\`, \`delete_events\`: read and modify the calendar.
- **Activities** — \`get_activities\`, \`get_activity\`, \`get_activity_streams\`: review completed training.
- **Wellness** — \`get_wellness\`, \`get_fitness_summary\`: CTL/ATL/TSB and recovery metrics.
- **Analysis** — \`get_power_curve\`, \`get_aerobic_decoupling\`, \`compare_intervals\`, \`get_training_week_summary\`: derived insights.
- **Verification** — \`compare_planned_vs_actual\`: was a session executed as prescribed? Pairs a completed activity with its planned event and compares step by step, rep by rep. Reports its alignment basis and declines to pair rather than guess — check this before drawing conclusions about how a block was delivered.
- **Athlete** — \`get_athlete\`: profile, FTP, zones.
- **Coaching** — \`get_coaching_context\`: one-call snapshot of athlete profile + today's fitness + recent wellness trend. Call at session start to ground workout decisions.
- **Prompts** — \`setup_coaching\`: user-invokable; walks the athlete through an interview and emits their personal \`season.md\` and \`steering.md\` for \`docs/personal/\`. The durable philosophy is the tracked \`coaching-philosophy\` skill.
`;

export const STATIC_INSTRUCTIONS =
  `# intervals-icu-mcp\n\n` +
  `You manage planned workouts and training analysis on Intervals.icu for the connected athlete. ` +
  `Always check \`list_workout_library\` first before composing a workout from scratch — the athlete may have curated templates whose intent and calibration matter.\n\n` +
  WORKOUT_SYNTAX_DOC +
  "\n" +
  WATTS_AT_API_RULE +
  "\n" +
  TOOL_INVENTORY;
