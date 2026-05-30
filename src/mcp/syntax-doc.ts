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
`;

export const WATTS_AT_API_RULE = `## Power targets at the API boundary

Reason about intensity in %MAP or %FTP per the coaching context, but **emit absolute watts** (e.g. \`220w\`, \`160w-256w\`) when calling \`create_workout\`, \`create_workout_library_item\`, or any other tool that writes to Intervals.icu. Intervals.icu's parser does not understand \`%MAP\`. \`%FTP\` is supported but couples the workout to whatever FTP is on file, which may not match the user's intent. Convert at the boundary, not in the user's library.
`;

export const TOOL_INVENTORY = `## Tool inventory (high-level)

- **Library — browse** — \`list_workout_library\`, \`get_workout_library_item\`: browse the athlete's saved workouts in Intervals.icu. Use this **before composing an ad-hoc workout** so you reuse the user's curated set.
- **Library — author** — \`create_workout_library_item\`: persist a new workout to the library. Embed a rationale block (basis + anchorWatts + intensities) so the workout becomes refreshable when MAP or FTP changes.
- **Library — bulk** — \`seed_workout_library\` (one-time canonical templates) and \`refresh_workout_library\` (regenerate watts when MAP/FTP changes — works on seeded *and* user-authored workouts that have a rationale block).
- **Workouts** — \`create_workout\`, \`create_strength_workout\`: schedule structured sessions on the calendar.
- **Events** — \`get_events\`, \`get_event\`, \`update_event\`, \`delete_events\`: read and modify the calendar.
- **Activities** — \`get_activities\`, \`get_activity\`, \`get_activity_streams\`: review completed training.
- **Wellness** — \`get_wellness\`, \`get_fitness_summary\`: CTL/ATL/TSB and recovery metrics.
- **Analysis** — \`get_power_curve\`, \`get_aerobic_decoupling\`, \`compare_intervals\`, \`get_training_week_summary\`: derived insights.
- **Athlete** — \`get_athlete\`: profile, FTP, zones.
- **Coaching** — \`get_coaching_context\`: one-call snapshot of athlete profile + today's fitness + recent wellness trend. Call at session start to ground workout decisions.
- **Prompts** — \`setup_coaching\`: user-invokable; walks the athlete through an interview, then emits \`philosophy.md\` and \`season.md\` for the user to upload to their Claude Project.
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
