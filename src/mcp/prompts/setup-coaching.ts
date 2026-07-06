import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const SETUP_COACHING_PROMPT = `You are bootstrapping the *personal* coaching context for the \`intervals-icu-mcp\` server. The coaching layer is a four-tier stack, each tier owned by a different system:

- **\`coaching-philosophy\` skill** (\`.claude/skills/coaching-philosophy/\`) — the athlete's *durable* coaching principles: intensity anchor, execution rules, recovery rules, biases, test cadence. **Tracked in git, ships with the server — do not author it here.** It's the base the athlete works from.
- **\`season.md\`** (\`docs/personal/season.md\`, gitignored) — current season block: races, dates, mesocycle structure, key constraints.
- **\`steering.md\`** (\`docs/personal/steering.md\`, gitignored) — thin *personal overrides* on the philosophy: a rule to relax/tighten, added emphasis, experiments. Overrides win on conflict. Empty is fine — it means "follow the philosophy as written."
- **\`intervals-coach\` skill** — workout-generation rules; ships with the server, activates automatically. The user doesn't author it.
- **Athlete state** (\`get_coaching_context\` tool) — FTP, MAP, zones, today's CTL/ATL/TSB, recent wellness. Always fresh from the API. Don't ask for FTP/zones — call the tool.

Your job: produce the two **personal** files, \`season.md\` and \`steering.md\`, for \`docs/personal/\`. You do **not** author philosophy — that's the tracked skill.

## Your task

1. Read \`.claude/skills/coaching-philosophy/SKILL.md\` so you know the base the athlete is overriding.
2. Call \`get_coaching_context\` to seed yourself with FTP, zones, and current fitness — do not ask for what you can read.
3. Conduct a tight interview (~5 minutes): season first, then any steering.
4. Produce \`season.md\` and \`steering.md\`. If you can write files, save them under \`docs/personal/\`; otherwise present them as fenced code blocks for the user to save there.

## Interview structure

### Season
- Competition calendar this year — dates, events, priorities.
- Year structure (mesocycles, blocks, phases). Roughly when does each start/end?
- Where are you right now in that structure?
- Non-negotiable constraints — track sessions, team commitments, weekly volume cap, family/work blocks?
- Strength training schedule — sessions per week; when does it taper?

### Steering (personal overrides — keep it thin; empty is fine)
- Any philosophy rule you want to relax or tighten for now (e.g. the Z2 NP cap, which days allow two-a-days)?
- Any extra emphasis for this period that *adds* to the philosophy without contradicting it?
- Anything you're trialling that isn't a settled belief yet?

If nothing comes up, \`steering.md\` stays empty — that means "follow the philosophy as written."

## Delivery

Write (or present) \`season.md\` and \`steering.md\` for \`docs/personal/\`. Then tell the user:

> These are your personal, gitignored files. Save \`season.md\` and \`steering.md\` under \`docs/personal/\`. The coaching skills read them at session-start, layered on top of the tracked \`coaching-philosophy\` skill — steering overrides the philosophy on conflict. Edit them any time; no upload needed. When a steering tweak proves durable, promote it up into the \`coaching-philosophy\` skill.

Scaffolds for both files live at \`https://github.com/robertgregorywest/intervals-icu-mcp/tree/main/templates/personal\`.

## Style for the documents

- Markdown, terse. Headings + bullets. No filler prose.
- Write in the *first person of the user* ("I prefer…", "Avoid…") so the LLM speaks in the athlete's voice.
- Include numeric values where relevant (watts, hours, dates) — they are the load-bearing parts.
- Do **not** include FTP, MAP, zones, or current fitness — those live in \`get_coaching_context\` and would only go stale here.
- Do **not** restate the durable philosophy — that's the \`coaching-philosophy\` skill. \`steering.md\` captures only *deviations*.

Begin by greeting the athlete, summarising what you'll do, and asking permission to read the \`coaching-philosophy\` skill and call \`get_coaching_context\` before the interview starts.`;

export function registerSetupCoachingPrompt(server: McpServer): void {
  server.registerPrompt(
    "setup_coaching",
    {
      title: "Set up coaching context",
      description:
        "Walk the athlete through a short interview, then emit their personal season.md and steering.md for docs/personal/ (philosophy is the tracked coaching-philosophy skill).",
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
