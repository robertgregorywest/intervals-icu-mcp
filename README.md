# intervals-icu-mcp

An MCP (Model Context Protocol) server for accessing your [Intervals.icu](https://intervals.icu) training data. Works with Claude Desktop and other MCP-compatible clients.

## Features

- **15 tools** covering activities, calendar events, fitness metrics, power curves, workout creation, wellness, and analysis
- **Structured workout creation**: build interval sessions on your Intervals.icu calendar using the native workout text syntax
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

| Tool                      | Description                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `get_athlete`             | Get athlete profile including FTP, LTHR, weight, HR/power/pace zones                  |
| `get_activities`          | List activities in a date range with summary metrics (TSS, IF, NP, HR, power)         |
| `get_activity`            | Get full details for a single activity, optionally with detected intervals            |
| `get_activity_streams`    | Get raw time-series data for an activity (power, HR, cadence, speed, altitude)        |
| `get_events`              | List calendar events (planned workouts, races, notes) in a date range                 |
| `get_event`               | Get details of a single calendar event including workout structure                    |
| `update_event`            | Update an existing calendar event (name, description, date, category, type, colour)   |
| `delete_events`           | Delete one or more calendar events by ID or external_id                               |
| `create_workout`          | Create a structured workout on the calendar with steps, ramps, and repeat blocks      |
| `create_strength_workout` | Create a strength/gym session as a WeightTraining event                               |
| `get_wellness`            | Get wellness data for a date range (CTL, ATL, weight, HRV, sleep, subjective metrics) |
| `get_fitness_summary`     | Today's fitness snapshot — CTL, ATL, TSB, HRV, sleep, and readiness                   |
| `get_power_curve`         | Get the athlete's power-duration curve for a date range or all time                   |
| `get_aerobic_decoupling`  | Calculate aerobic decoupling (Pw:Hr) for an activity — measures cardiac drift         |
| `compare_intervals`       | Compare intervals across multiple activities side-by-side                             |

## Example Prompts

- "What activities did I do last week and how was my training load?"
- "What's my current fitness — CTL, ATL, and form?"
- "Show me my power curve for the last 90 days"
- "Create a 4x8 minute threshold workout at 250w with 4 minute recoveries for next Tuesday"
- "What's the aerobic decoupling on my last long ride?"
- "How has my FTP changed over the last year?"
- "Add a strength session to my calendar for tomorrow — 3 sets of squats, deadlifts, and lunges"
- "Compare the power output across my last 5 interval sessions"

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
