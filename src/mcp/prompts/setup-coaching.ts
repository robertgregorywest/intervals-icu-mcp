import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const SETUP_COACHING_PROMPT = `You are bootstrapping coaching context for the \`intervals-icu-mcp\` server. The athlete wants this server to act like a coach — picking workouts, building plans, and offering analysis. The coaching layer is split across three surfaces, each owned by a different system:

- **\`philosophy.md\`** (Claude Project knowledge) — timeless coaching principles: intensity model, recovery rules, biases, what "good" execution looks like.
- **\`season.md\`** (Claude Project knowledge) — current season block: races, dates, mesocycle structure, key constraints.
- **\`intervals-coach\` skill** (\`.claude/skills/intervals-coach/\`) — workout-generation rules: ships with the server, activates automatically when the athlete works on workouts. The user already has it; they don't need to author it.
- **Athlete state** (\`get_coaching_context\` tool) — FTP, MAP, zones, today's CTL/ATL/TSB, recent wellness. Always fresh from the API. Don't ask for FTP/zones in the interview — call the tool.

Your job: produce two markdown files (\`philosophy.md\` and \`season.md\`) that the user uploads to a Claude Project as Project knowledge.

## Your task

1. Call \`get_coaching_context\` first to seed yourself with FTP, zones, and current fitness — do not ask the athlete for things you can read.
2. Conduct a tight interview (~5–10 minutes total).
3. Emit \`philosophy.md\` and \`season.md\` as code-block artifacts the user can copy.
4. Tell the user how to add them to a Claude Project (see "Delivery" below).

## Interview structure

For each file, ask 3–5 targeted questions. Adapt to the athlete; skip what isn't applicable.

### Philosophy (timeless)
- Primary intensity anchor — MAP, FTP, HR, or feel — and why?
- Execution rules to follow (e.g., NP caps on Z2, no hard days back-to-back, recovery week cadence)?
- Bias — polarized, sweet-spot, threshold-heavy, masters-style "fewer hard days done well"?
- Anything that should never happen in a plan (e.g., VO2 the day after heavy strength)?
- Test-vs-train, hero sessions, and quality vs. volume trade-offs?

### Season
- Competition calendar this year — dates, events, priorities.
- Year structure (mesocycles, blocks, phases). Roughly when does each start/end?
- Where are you right now in that structure?
- Non-negotiable constraints — track sessions, team commitments, weekly volume cap, family/work blocks?
- Strength training schedule — sessions per week; when does it taper?

## Delivery

Present the final \`philosophy.md\` and \`season.md\` content as separate fenced code blocks. Then tell the user:

> Copy each block into a markdown file. In Claude.ai, open (or create) a Project for your training, click "Add knowledge", and upload \`philosophy.md\` and \`season.md\`. The next time you start a chat in that project, this context will be loaded automatically — no server restart needed. To update later, edit the file and re-upload, or edit the knowledge directly in the Project UI.

The repo at \`https://github.com/robertgregorywest/intervals-icu-mcp/tree/main/templates/project-knowledge\` ships scaffold versions of both files for hand-authoring.

## Style for the documents

- Markdown, terse. Headings + bullets. No filler prose.
- Write rules and biases in *first person of the user* ("I prefer…", "Avoid…") so the LLM speaks with the athlete's voice.
- Include numeric values where relevant (watts, hours, dates) — they are the load-bearing parts.
- Do **not** include FTP, MAP, zones, or current fitness in these docs — those live in \`get_coaching_context\` and would only go stale here.

Begin by greeting the athlete, summarising what you'll do, and asking permission to call \`get_coaching_context\` to seed yourself before the interview starts.`;

export function registerSetupCoachingPrompt(server: McpServer): void {
  server.registerPrompt(
    "setup_coaching",
    {
      title: "Set up coaching context",
      description:
        "Walk the athlete through a short interview, then emit philosophy.md and season.md for them to upload as Claude Project knowledge.",
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
