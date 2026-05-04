# intervals-icu-mcp

An MCP (Model Context Protocol) server for accessing your [Intervals.icu](https://intervals.icu) training data. Works with Claude Desktop and other MCP-compatible clients.

## Features

- **21 tools** covering activities, calendar events, fitness metrics, power curves, workout creation, a managed workout library, wellness, analysis, and weekly summaries
- **Structured workout creation**: build interval sessions on your Intervals.icu calendar using the native workout text syntax
- **Workout library as a coaching template store**: browse, author, seed, and refresh saved workouts in your Intervals.icu library. Workouts carry an embedded rationale block (%MAP / %FTP intent) so absolute watts can be regenerated when your fitness changes.
- **Coach mode**: drop three markdown files (`philosophy.md`, `season.md`, `athlete.md`) into a config directory and the server injects them into MCP `instructions` so the LLM behaves as your coach. Use the `/setup_coaching` MCP prompt for a guided setup.
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

| Tool                          | Description                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `get_athlete`                 | Get athlete profile including FTP, LTHR, weight, HR/power/pace zones                                                         |
| `get_activities`              | List activities in a date range with summary metrics (TSS, IF, NP, HR, power)                                                |
| `get_activity`                | Get full details for a single activity, optionally with detected intervals                                                   |
| `get_activity_streams`        | Get raw time-series data for an activity (power, HR, cadence, speed, altitude)                                               |
| `get_events`                  | List calendar events (planned workouts, races, notes) in a date range                                                        |
| `get_event`                   | Get details of a single calendar event including workout structure                                                           |
| `update_event`                | Update an existing calendar event (name, description, date, category, type, colour)                                          |
| `delete_events`               | Delete one or more calendar events by ID or external_id                                                                      |
| `create_workout`              | Create a structured workout on the calendar with steps, ramps, and repeat blocks                                             |
| `create_strength_workout`     | Create a strength/gym session as a WeightTraining event                                                                      |
| `list_workout_library`        | List the athlete's saved workouts in Intervals.icu (folders + name + one-line summary). Optional `folder` filter             |
| `get_workout_library_item`    | Get the full body of a saved workout including its parsed rationale (intent, %MAP/%FTP basis)                                |
| `create_workout_library_item` | Author and persist a new workout to the library. Embed a rationale block to make it refreshable when MAP/FTP changes         |
| `seed_workout_library`        | One-time populate the library with 9 canonical cycling templates (FTP test, MAP ramp, VO2, threshold, sweet spot, etc.)      |
| `refresh_workout_library`     | Regenerate watts on every workout with a rationale block when MAP or FTP changes — preserves user-edited prose and structure |
| `get_wellness`                | Get wellness data for a date range (CTL, ATL, weight, HRV, sleep, subjective metrics)                                        |
| `get_fitness_summary`         | Today's fitness snapshot — CTL, ATL, TSB, HRV, sleep, and readiness                                                          |
| `get_power_curve`             | Get the athlete's power-duration curve for a date range or all time                                                          |
| `get_aerobic_decoupling`      | Calculate aerobic decoupling (Pw:Hr) for an activity — measures cardiac drift                                                |
| `compare_intervals`           | Compare intervals across multiple activities side-by-side                                                                    |
| `get_training_week_summary`   | Bundle activities + wellness + planned events for a week into one snapshot                                                   |

## MCP Prompts

| Prompt           | Description                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup_coaching` | Walks the athlete through a short interview, then writes `philosophy.md` / `season.md` / `athlete.md` to the coaching directory so the server can act as a coach. |

## Coach mode

The server can act as your coach by loading three markdown files from a config directory at startup and injecting them into the MCP `instructions` field every conversation:

| File            | Purpose                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `philosophy.md` | Timeless coaching principles (intensity model, recovery rules, biases)    |
| `season.md`     | Current season block — races, dates, mesocycle structure, key constraints |
| `athlete.md`    | Current athlete state — MAP / FTP / zones, availability, niggles          |

Default location: `~/.intervals-icu-mcp/coaching/`. Override with the `INTERVALS_COACHING_DIR` env var.

**Easiest way to set them up:** in Claude Desktop, run the `setup_coaching` MCP prompt. The LLM will interview you across the three areas, then write the files (using the host's filesystem tools, or showing them in code blocks for you to save). After the files exist, restart the host so the new context loads.

**Power-user route:** hand-author the files. Scaffolds with placeholder structure live at [`templates/coaching/`](templates/coaching/) in this repo.

The combined size is capped at 20 000 chars; larger inputs get truncated with a stderr warning. Restart the host after editing any file for changes to take effect.

## Workout library

`intervals-icu-mcp` treats your Intervals.icu library (the saved-workouts feature) as a first-class template store the LLM can read and write:

- **Browse**: `list_workout_library` returns folders and a one-line summary per workout. `get_workout_library_item` returns the full body plus a parsed rationale block.
- **Bulk-author**: `seed_workout_library` populates a `Coach: <category>` set of folders with 9 canonical cycling templates (FTP 20-min test, MAP ramp, VO2 4×4, VO2 30/30, Threshold 2×20, Sweet Spot 3×12, Z2 endurance, MIET, Recovery). Idempotent skip-by-name.
- **Author one-off**: `create_workout_library_item` lets the coach persist a new workout it has composed. If the LLM includes a rationale (`{ basis, anchorWatts, intensities }`), the workout becomes refreshable — its absolute watts can be regenerated later when MAP or FTP changes.
- **Refresh**: `refresh_workout_library` walks the library, finds every workout with a rationale block, and regenerates the watts in step lines using the new anchor. User-edited prose, step labels, durations, cadence, and structure are preserved — only the watts move. Idempotent: workouts already at the requested anchor are skipped.

The rationale lives in an HTML comment at the end of the workout description (invisible in the Intervals.icu UI), so refresh-ability is opt-in and non-disruptive.

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

| Variable                 | Required | Default                          | Description                                                                                               |
| ------------------------ | -------- | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `INTERVALS_API_KEY`      | Yes      | —                                | API key from Intervals.icu Settings → API                                                                 |
| `INTERVALS_ATHLETE_ID`   | No       | `0`                              | Athlete ID (0 = authenticated user)                                                                       |
| `INTERVALS_COACHING_DIR` | No       | `~/.intervals-icu-mcp/coaching/` | Directory containing `philosophy.md` / `season.md` / `athlete.md` (loaded into `instructions` at startup) |

## Development

```bash
npm run build       # Compile TypeScript
npm test            # Run tests
npm run typecheck   # Type-check without emitting
npm start           # Run MCP server via stdio
```

## License

MIT
