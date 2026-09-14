// Builds a skill-eval case from a real moment (issue #20): the personal files
// as they stood on the scenario date, a case.yaml skeleton to fill with
// expectations, and — with --record — its cassette, recorded live once.
//
//   npm run eval:capture -- --skill execution-review --id er-rp-miss \
//     --date 2026-08-09 --prompt "/execution-review window 2026-08-02 → 2026-08-09" --record

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { git as gitIn } from "./lib/git.js";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const PERSONAL = join(REPO_ROOT, "docs", "personal");
// What coaching skills read from docs/personal.
const PERSONAL_FILES = [
  "steering.md",
  "season.md",
  "coaching-log.md",
  "track-context.md",
];

const { values: args } = parseArgs({
  options: {
    skill: { type: "string" },
    id: { type: "string" },
    date: { type: "string" },
    prompt: { type: "string" },
    description: { type: "string" },
    tags: { type: "string" },
    rev: { type: "string" },
    record: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
    scenarios: { type: "string", default: "docs/personal/evals/scenarios" },
  },
});

const { skill, id, date, prompt } = args;
if (!skill || !id || !date || !prompt) {
  throw new Error(
    "--skill, --id, --date (YYYY-MM-DD) and --prompt are required"
  );
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("--date is YYYY-MM-DD");

const caseDir = resolve(REPO_ROOT, args.scenarios, skill, id);
if (existsSync(caseDir) && !args.force) {
  throw new Error(`${caseDir} exists — pass --force to overwrite its skeleton`);
}

const git = (...a: string[]) => gitIn(PERSONAL, ...a);

// docs/personal is its own repo: take the last commit on or before the
// scenario date, or the working tree when the history starts later.
const rev =
  args.rev ?? git("rev-list", "-1", `--before=${date} 23:59:59`, "HEAD");
const source = rev
  ? `docs/personal@${git("rev-parse", "--short", rev)}`
  : "working tree";

function readPersonal(file: string): string | null {
  if (!rev) {
    const path = join(PERSONAL, file);
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  }
  try {
    return git("show", `${rev}:${file}`) + "\n";
  } catch {
    return null;
  }
}

/** Drops log entries dated after the scenario — the future it can't know. */
function trimLog(text: string): { text: string; dropped: number } {
  const parts = text.split(/^(?=### \d{4}-\d{2}-\d{2})/m);
  const kept = parts.filter((p) => {
    const d = p.match(/^### (\d{4}-\d{2}-\d{2})/)?.[1];
    return !d || d <= date!;
  });
  return { text: kept.join(""), dropped: parts.length - kept.length };
}

mkdirSync(join(caseDir, "personal"), { recursive: true });
const notes: string[] = [];
for (const file of PERSONAL_FILES) {
  let text = readPersonal(file);
  if (text === null) continue;
  if (file === "coaching-log.md") {
    const trimmed = trimLog(text);
    text = trimmed.text;
    if (trimmed.dropped)
      notes.push(`dropped ${trimmed.dropped} later log entries`);
  }
  writeFileSync(join(caseDir, "personal", file), text);
}
if (!rev) {
  notes.push(
    "no personal history that early — steering, season and the log header are today's; edit them back to the scenario date"
  );
}

const q = (s: string) => JSON.stringify(s);
const tags = (args.tags ?? "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const GRADERS: Record<string, string> = {
  "execution-review": `  - type: completed
  - type: skillInvoked
  - type: readOnly
  - type: watermarkLine
    # or "skipped: no key session in <window>"
    expect: ${q(`reviewed through: ${date}`)}
  - type: noRawDump
  - type: noReplayMisses
  # TODO: each key session in the window and where it should land — reported
  # (recurs, so raised) or held (seen once). \`match\` is how the report may name it.
  # - type: sessionsDispositioned
  #   sessions:
  #     - { match: "6 Aug|08-06", as: reported }
  #     - { match: "2 Aug|08-02", as: held }
  # TODO: what this window should surface or hold, e.g.
  # - type: mentions
  #   mustMention: []
  #   mustNotMention: []
  - type: llmRubric
    name: reporting-rules
    target: skillReport
    criteria: |
      The output is an execution review handed back to a coach.
      PASS if all of these hold:
      - It reports the window's middle-band (76–106% FTP) figure as planned vs delivered.
      - Each finding it raises names the session(s) evidencing it; a shortfall seen in only
        one session is not presented as a pattern.
      - Findings are framed as what to change, not as compliance or marking.
      - It does not prescribe the next block or plan training.
      FAIL if any of these is violated, or if it reports warm-up, cool-down or recovery-step
      "under" verdicts as shortfalls.
`,
  "plan-workout": `  - type: completed
  - type: skillInvoked
  - type: skillInvoked
    skill: compose-workout
  - type: noReplayMisses
  # TODO: exactly the calendar writes a good run makes (expect: [] for none),
  # on the workout's date — not necessarily the scenario date.
  - type: writes
    expect:
      - method: POST
        path: /events(/bulk)?$
        body: '"start_date_local":"${date}'
  - type: workoutParses
  # TODO: the intent's zone (or watts) and time, e.g.
  # - type: targetsInBand
  #   zone: L5            # a MAP zone, or [L3, L4]; or band: [lowW, highW] for a %FTP intent
  #   workMinutes: { min: 0, max: 0 }
  # - type: durationWithin
  #   maxMinutes: 90
  - type: llmRubric
    name: coaching-fit
    criteria: |
      TODO: what a good coach does here — e.g. uses library workout <id>, respects the
      midweek time cap, pushes back on intensity in a recovery week.
`,
};

writeFileSync(
  join(caseDir, "case.yaml"),
  `id: ${id}
skill: ${skill}
description: >
  ${args.description ?? "TODO: the real moment this captures and what a good run does."}
  Personal files from ${source}.
scenarioDate: ${q(date)}
prompt: ${q(prompt)}
# followups: []   # later user turns, e.g. answering "save to the library?"
maxTurns: 40
timeoutSeconds: 900
tags: [${tags.join(", ")}]
graders:
${GRADERS[skill] ?? "  - type: completed\n  - type: skillInvoked\n  - type: noReplayMisses\n"}`
);

console.log(`case → ${caseDir}`);
console.log(`personal files from ${source}`);
for (const n of notes) console.log(`  note: ${n}`);

if (args.record) {
  const res = spawnSync(
    "npx",
    [
      "tsx",
      join(import.meta.dirname, "run.ts"),
      "--case",
      id,
      "--record",
      "--effort",
      "low",
    ],
    { cwd: REPO_ROOT, stdio: "inherit" }
  );
  if (res.status !== 0) process.exit(res.status ?? 1);
} else {
  console.log(`next: npm run eval:skills -- --case ${id} --record`);
}
