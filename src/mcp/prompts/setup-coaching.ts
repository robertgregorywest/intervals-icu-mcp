import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const SETUP_COACHING_PROMPT = `You are bootstrapping coaching context for the \`intervals-icu-mcp\` server. The athlete is interacting with you because they want this server to act like a coach — picking workouts, building plans, and offering analysis. To do that well, the server reads three markdown files at startup and injects them into your instructions:

- **\`philosophy.md\`** — timeless coaching principles (intensity model, recovery rules, biases, what "good" execution looks like).
- **\`season.md\`** — current season block: races, dates, mesocycle structure, key constraints.
- **\`athlete.md\`** — current athlete state: MAP / FTP / zones, training availability, strengths and limitations, niggles.

These files live at \`~/.intervals-icu-mcp/coaching/\` by default (or wherever the \`INTERVALS_COACHING_DIR\` env var points). They are plain markdown — the user can edit them in any editor at any time.

## Your task

Conduct a short, focused interview with the user, then write each of the three files. Keep the interview tight: aim for ~5–10 minutes total. Don't ask anything you can derive from MCP tools — call \`get_athlete\` and \`get_fitness_summary\` first to seed yourself with FTP, zones, and recent fitness.

## Interview structure

For each file, ask 3–5 targeted questions. **Suggested prompts** (adapt to the athlete; skip what isn't applicable):

### Philosophy (timeless)
- What's your primary intensity anchor — MAP, FTP, HR, or feel — and why?
- Are there execution rules you want followed (e.g., NP caps on Z2, no hard days back-to-back, recovery week cadence)?
- What's your bias — polarized, sweet-spot, threshold-heavy, masters-style "fewer hard days done well"?
- Anything that should never happen in a plan (e.g., VO2 the day after heavy strength)?
- How should I think about test-vs-train, hero sessions, and quality vs. volume trade-offs?

### Season
- What's your competition calendar this year? Dates, events, priorities.
- How is the year structured (mesocycles, blocks, phases)? Roughly when does each start/end?
- Where are you right now in that structure?
- Any non-negotiable constraints — track sessions, team commitments, weekly volume cap, family/work blocks?
- Strength training schedule — sessions per week, when in the season does it taper?

### Athlete
- Current MAP (W) and FTP (W). When were each last tested? When is the next test due?
- Power zones (or anchor + ranges if you don't use canonical zones).
- Weekly training hours available, broken down by weekday vs weekend if relevant.
- Strengths and weaknesses (durability, repeatability, sprint, threshold, etc.).
- Current niggles, limitations, or fatigue indicators to watch.

## Writing the files

Default output directory: \`~/.intervals-icu-mcp/coaching/\` (resolve \`~\` to the user's home directory). Honor \`INTERVALS_COACHING_DIR\` if set in the user's environment.

For each file: confirm the content with the user, then write it. **If you have access to a filesystem write tool** (e.g., from a filesystem MCP server), use it. **If you do not**, present the final content in a code block and tell the user the exact path to save it to.

The repo at \`https://github.com/robertgregorywest/intervals-icu-mcp/tree/main/templates/coaching\` contains scaffold versions of these files if the user prefers to hand-author starting from a stub.

After all three files are written, tell the user:

> Restart Claude Desktop to reload the coaching instructions. After restart, ask me to "list my workout library" to confirm the server is healthy.

## Style for the documents

- Markdown, terse. Headings + bullets. No filler prose.
- Write rules and biases in *first person of the user* ("I prefer…", "Avoid…") so the LLM speaks with the athlete's voice.
- Include numeric values where relevant (watts, hours, dates) — they are the load-bearing parts.

Begin by greeting the athlete, summarizing what you'll do, and asking for permission to call \`get_athlete\` and \`get_fitness_summary\` to seed yourself before the interview starts.`;

export function registerSetupCoachingPrompt(server: McpServer): void {
  server.registerPrompt(
    "setup_coaching",
    {
      title: "Set up coaching context",
      description:
        "Walk the athlete through a short interview, then write philosophy.md / season.md / athlete.md to the coaching directory so the server can act as a coach.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: { type: "text", text: SETUP_COACHING_PROMPT },
        },
      ],
    })
  );
}

export { SETUP_COACHING_PROMPT };
