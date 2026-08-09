# intervals-icu-mcp

An MCP (Model Context Protocol) server for accessing your [Intervals.icu](https://intervals.icu) training data. Works with Claude Desktop and other MCP-compatible clients.

## Features

- **22 tools** covering activities, calendar events, fitness metrics, power curves, workout creation, a managed workout library, wellness, analysis, weekly summaries, planned-vs-actual session verification, and a one-call coaching snapshot
- **Structured workout creation**: build interval sessions on your Intervals.icu calendar using the native workout text syntax
- **Workout library as tracked files**: curated workouts live as Markdown templates in `templates/workouts/`, written in %MAP / %FTP. One command renders them at your current test values and reconciles your Intervals.icu library, so absolute watts follow your fitness.
- **Coach mode**: bundled skills carry the coaching logic — `coaching-philosophy` (durable principles, tracked in git), `coaching-session`, and `intervals-coach` (workout generation). Personalise with your gitignored `docs/personal/steering.md` (overrides that win on conflict) and `season.md`. Athlete state (FTP, zones, fitness) comes from the `get_coaching_context` tool — always fresh, no files to maintain.
- **Analysis tools**: aerobic decoupling, interval comparison, power curves, and fitness trends

## Quick Start

### One-Click Install (Claude Desktop)

1. Download the latest `.mcpb` file from [Releases](https://github.com/robertgregorywest/intervals-icu-mcp/releases)
2. Double-click the `.mcpb` file — Claude Desktop will open and prompt you to install
3. Enter your Intervals.icu API key when prompted (find it under **Settings → API**)

No Node.js installation required. Claude Desktop bundles its own runtime.

### Manual Configuration (Claude Desktop)

Requires **Node.js 20+**.

1. Clone and build:

   ```bash
   git clone https://github.com/robertgregorywest/intervals-icu-mcp.git
   cd intervals-icu-mcp
   npm install
   npm run build
   ```

2. Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

   ```json
   {
     "mcpServers": {
       "intervals-icu": {
         "command": "node",
         "args": ["/absolute/path/to/intervals-icu-mcp/dist/mcp/stdio.js"],
         "env": {
           "INTERVALS_API_KEY": "your-api-key"
         }
       }
     }
   }
   ```

3. Restart Claude Desktop.

## Available Tools

| Tool                             | Description                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_athlete`                    | Get athlete profile including FTP, LTHR, weight, HR/power/pace zones                                                                                                                                                                                                                                                                     |
| `get_activities`                 | List activities in a date range with summary metrics (TSS, IF, NP, HR, power)                                                                                                                                                                                                                                                            |
| `get_activity`                   | Get full details for a single activity, optionally with detected intervals                                                                                                                                                                                                                                                               |
| `get_activity_streams`           | Get raw time-series data for an activity (power, HR, cadence, speed, altitude)                                                                                                                                                                                                                                                           |
| `get_events`                     | List calendar events (planned workouts, races, notes) in a date range                                                                                                                                                                                                                                                                    |
| `get_event`                      | Get details of a single calendar event including workout structure                                                                                                                                                                                                                                                                       |
| `update_event`                   | Update an existing calendar event (name, description, date, category, type, colour)                                                                                                                                                                                                                                                      |
| `delete_events`                  | Delete one or more calendar events by ID or external_id                                                                                                                                                                                                                                                                                  |
| `create_workout`                 | Create a structured workout on the calendar with steps, ramps, and repeat blocks                                                                                                                                                                                                                                                         |
| `create_strength_workout`        | Create a strength/gym session as a WeightTraining event                                                                                                                                                                                                                                                                                  |
| `list_workout_library`           | List the athlete's saved workouts in Intervals.icu (folders + name + one-line summary). Optional `folder` filter                                                                                                                                                                                                                         |
| `get_workout_library_item`       | Get the full body of a saved workout, plus the `seedId` of the template it renders from                                                                                                                                                                                                                                                  |
| `sync_workout_library`           | Render every tracked template at the current MAP/FTP and upsert it: creates what's missing, updates what changed, re-anchors watts. Never deletes                                                                                                                                                                                        |
| `get_wellness`                   | Get wellness data for a date range (CTL, ATL, weight, HRV, sleep, subjective metrics)                                                                                                                                                                                                                                                    |
| `get_fitness_summary`            | Today's fitness snapshot — CTL, ATL, TSB, HRV, sleep, and readiness                                                                                                                                                                                                                                                                      |
| `get_power_curve`                | Get the athlete's power-duration curve for a date range or all time                                                                                                                                                                                                                                                                      |
| `get_aerobic_decoupling`         | Calculate aerobic decoupling (Pw:Hr) for an activity — measures cardiac drift                                                                                                                                                                                                                                                            |
| `compare_intervals`              | Compare intervals across multiple activities side-by-side                                                                                                                                                                                                                                                                                |
| `compare_planned_vs_actual`      | Verify a session was executed as prescribed — pairs an activity with its planned event and reports each step's prescription against delivery, rep by rep, read from the laps the head unit recorded. Declines to guess when it can't align                                                                                               |
| `compare_intensity_distribution` | Was the prescribed _dose_ delivered? Computes planned and delivered time-in-zone in one frame (from the prescription's steps and the recorded power, not from platform figures), plus the 76–106% FTP middle-band roll-up, for a session or a date range. Needs no step alignment, so it works where `compare_planned_vs_actual` refuses |
| `get_training_week_summary`      | Bundle activities + wellness + planned events for a week into one snapshot                                                                                                                                                                                                                                                               |
| `get_coaching_context`           | One-call snapshot — athlete profile, today's CTL/ATL/TSB, a wellness trend (default 7d, max 30d), and **MAP** derived from the most recent `MAP ramp test*` activity in the last 90 days                                                                                                                                                 |

## MCP Prompts

| Prompt           | Description                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup_coaching` | Interviews the athlete and emits their personal `season.md` + `steering.md` for `docs/personal/`. Philosophy is the tracked `coaching-philosophy` skill, not authored here. |

## Coach mode

Coach mode is a four-tier context stack — most-durable first, later tiers override earlier ones on conflict — none of which require restarting the server:

| Concern                           | Where it lives                                                                                              | How to update                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Coaching philosophy (durable)     | `coaching-philosophy` skill at [`.claude/skills/coaching-philosophy/`](.claude/skills/coaching-philosophy/) | Edit the skill files; commit                               |
| Personal overrides + season       | `docs/personal/steering.md` (overrides, win on conflict) + `docs/personal/season.md` (gitignored)           | Edit the files                                             |
| Workout-generation rules          | `intervals-coach` skill at [`.claude/skills/intervals-coach/`](.claude/skills/intervals-coach/)             | Edit the skill files; re-load Claude                       |
| Athlete state (FTP, MAP, fitness) | `get_coaching_context` tool                                                                                 | Always fresh — re-tested values flow through automatically |

The durable coaching **philosophy is tracked in git** as the `coaching-philosophy` skill — the base every install shares. A single athlete personalises it with the gitignored `docs/personal/steering.md` (overrides) and `season.md`; when a steering tweak proves durable, promote it up into the skill.

**Bootstrapping**: run the `setup_coaching` MCP prompt. The LLM reads the `coaching-philosophy` skill, calls `get_coaching_context` for FTP/zones/current fitness, interviews you on your current season and any personal steering, then emits `season.md` + `steering.md` for `docs/personal/`.

**Skill installation**: the coaching skills ship in this repo at `.claude/skills/` and are already available locally. To use them in another project, install via the [`skills`](https://github.com/vercel-labs/skills) CLI:

```bash
npx skills add robertgregorywest/intervals-icu-mcp --skill coaching-philosophy --skill coaching-session --skill intervals-coach
```

Add `-g` to install globally instead of per-project. Drop the `--skill` flags to pick interactively from everything in `.claude/skills/`.

**Hand-authoring**: scaffolds for the personal `season.md` and `steering.md` live at [`templates/personal/`](templates/personal/).

## Workout library

`intervals-icu-mcp` treats your Intervals.icu library (the saved-workouts feature) as a first-class template store the LLM can read and write:

- **Browse**: `list_workout_library` returns folders plus, for each workout, a one-line summary, a `purpose` saying what it is _for_, and `hasTemplate` marking the ones sync maintains. `get_workout_library_item` returns the full body and its `seedId`.
- **Author**: write a Markdown file in [`templates/workouts/`](templates/workouts/) — frontmatter (`seedId`, `name`, `folder`, `purpose`, optional `basis`) plus a body in Intervals.icu step syntax. A bare `%` is resolved against `basis` at render; literal watts, zones, `% LTHR` and cadence pass through untouched. Repeats may nest by indentation.
- **Sync**: `sync_workout_library` renders every template at the supplied MAP/FTP and upserts it, matched by a `<!-- template: <seedId> -->` marker. It creates what's missing, updates whatever differs (steps, prose, name or folder), and re-anchors watts when a test value moves. Idempotent — it skips anything already identical. Use `dryRun` to preview.

The template files are the source of truth; the Intervals.icu library is a rendered view, so edits made in the Intervals.icu UI are overwritten on the next sync. Sync never deletes: a workout whose template has gone is reported as an orphan. See [ADR 0005](docs/adr/0005-workout-templates-as-tracked-files.md).

## Example Prompts

Activities, training, and analysis:

- "What activities did I do last week and how was my training load?"
- "What's my current fitness — CTL, ATL, and form?"
- "Show me my power curve for the last 90 days"
- "What's the aerobic decoupling on my last long ride?"
- "How has my FTP changed over the last year?"
- "Compare the power output across my last 5 interval sessions"

Calendar and workout creation:

- "Create a 4x8 minute threshold workout at 250w with 4 minute recoveries for next Tuesday"
- "Add a strength session to my calendar for tomorrow — 3 sets of squats, deadlifts, and lunges"

Coach mode + workout library (after running `/setup_coaching`):

- "Plan the next two weeks based on my current macro phase"
- "Browse my workout library and pick something appropriate for tomorrow given my fatigue"
- "Save this VO2 session you just designed as a reusable template"
- "My MAP just retested at 410W — refresh the library"

## Environment Variables

| Variable               | Required | Default | Description                               |
| ---------------------- | -------- | ------- | ----------------------------------------- |
| `INTERVALS_API_KEY`    | Yes      | —       | API key from Intervals.icu Settings → API |
| `INTERVALS_ATHLETE_ID` | No       | `0`     | Athlete ID (0 = authenticated user)       |

## Development

```bash
npm run build       # Compile TypeScript
npm test            # Run tests
npm run typecheck   # Type-check without emitting
npm start           # Run MCP server via stdio
```

## License

MIT
