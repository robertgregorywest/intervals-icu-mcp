// Skill eval runner (issue #20). Manual only — never part of test, build or
// release. Sweeps models × effort over the scenarios in docs/personal/evals,
// replaying each one's recorded Intervals.icu data.
//
//   npm run eval:skills -- --case er-* --models claude-sonnet-5 --effort low,high --trials 3
//   npm run eval:skills -- --case <id> --record   # fill a case's cassette live
//   npm run eval:skills -- --case <id> --models … --record-missing   # top it up

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseDotenv } from "dotenv";
import type { CapturedWrite, ReplayMiss } from "../../src/cassette.js";
import { gradeRun, score } from "./graders/index.js";
import { runAgent } from "./lib/agent.js";
import { loadCases } from "./lib/case.js";
import { extract } from "./lib/transcript.js";
import {
  EFFORTS,
  type Effort,
  type EvalCase,
  type GradeResult,
} from "./lib/types.js";
import { buildWorkspace, type SubagentModel } from "./lib/workspace.js";

const REPO_ROOT = resolve(import.meta.dirname, "../..");

const { values: args } = parseArgs({
  options: {
    models: { type: "string", default: "claude-sonnet-5" },
    effort: { type: "string", default: "medium" },
    trials: { type: "string", default: "3" },
    case: { type: "string" },
    skill: { type: "string" },
    tag: { type: "string" },
    "judge-model": { type: "string", default: "claude-sonnet-5" },
    concurrency: { type: "string", default: "2" },
    "max-cost-usd": { type: "string", default: "10" },
    "run-budget-usd": { type: "string", default: "3" },
    "subagent-model": { type: "string", default: "inherit" },
    scenarios: { type: "string", default: "docs/personal/evals/scenarios" },
    results: { type: "string", default: "docs/personal/evals/results" },
    record: { type: "boolean", default: false },
    "record-missing": { type: "boolean", default: false },
    "keep-workspace": { type: "boolean", default: false },
  },
});

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const models = list(args.models);
const efforts = list(args.effort) as Effort[];
for (const e of efforts) {
  if (!EFFORTS.includes(e))
    throw new Error(`Unknown effort "${e}" (${EFFORTS.join("|")})`);
}
const subagentModel = args["subagent-model"] as SubagentModel;
if (!["inherit", "pinned"].includes(subagentModel)) {
  throw new Error("--subagent-model is inherit or pinned");
}
const record = args.record;
// Replay what the cassette holds; fetch and add whatever a run asks beyond it.
const topUp = args["record-missing"];
if (record && topUp) throw new Error("--record or --record-missing, not both");
const live = record || topUp;
const trials = record ? 1 : Number(args.trials);
const maxCost = Number(args["max-cost-usd"]);

const cases = loadCases(resolve(REPO_ROOT, args.scenarios), {
  skill: args.skill,
  caseGlob: args.case,
  tag: args.tag,
});
if (cases.length === 0) throw new Error("No cases matched");

interface RunSpec {
  evalCase: EvalCase;
  model: string;
  effort: Effort;
  trial: number;
}

const specs: RunSpec[] = [];
for (const evalCase of cases) {
  if (!record && !existsSync(join(evalCase.dir, "cassette"))) {
    throw new Error(
      `${evalCase.id} has no cassette — run it once with --record`
    );
  }
  for (const model of record ? models.slice(0, 1) : models) {
    for (const effort of record ? efforts.slice(0, 1) : efforts) {
      for (let trial = 1; trial <= trials; trial++) {
        specs.push({ evalCase, model, effort, trial });
      }
    }
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const resultsDir = resolve(
  REPO_ROOT,
  args.results,
  record ? `${stamp}-record` : topUp ? `${stamp}-top-up` : stamp
);
mkdirSync(resultsDir, { recursive: true });

function git(...a: string[]): string {
  return execFileSync("git", a, { cwd: REPO_ROOT }).toString().trim();
}

const config = {
  startedAt: new Date().toISOString(),
  mode: record ? "record" : topUp ? "top-up" : "replay",
  models,
  efforts,
  trials,
  judgeModel: args["judge-model"],
  subagentModel,
  cases: cases.map((c) => c.id),
  gitSha: git("rev-parse", "HEAD"),
  // Uncommitted edits to anything the skills read make results unreproducible.
  skillsDirty:
    git(
      "status",
      "--porcelain",
      "--",
      ".claude",
      "docs/agents",
      "src",
      "bin"
    ) !== "",
  claudeVersion: null as string | null,
};

interface RunRecord {
  caseId: string;
  model: string;
  effort: Effort;
  trial: number;
  score: number;
  passed: boolean;
  grades: GradeResult[];
  costUsd: number;
  judgeCostUsd: number;
  turns: number;
  durationMs: number;
  error: string | null;
  runDir: string;
}

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

function credentials(): Record<string, string> {
  const dotenv = parseDotenv(readFileSync(join(REPO_ROOT, ".env")));
  if (!dotenv.INTERVALS_API_KEY)
    throw new Error("Recording needs INTERVALS_API_KEY in .env");
  return {
    INTERVALS_API_KEY: dotenv.INTERVALS_API_KEY,
    INTERVALS_ATHLETE_ID: dotenv.INTERVALS_ATHLETE_ID ?? "0",
  };
}

function cassetteEnv(cassetteDir: string): Record<string, string> {
  if (record) return { ...credentials(), ICU_RECORD_DIR: cassetteDir };
  if (topUp) {
    return {
      ...credentials(),
      ICU_REPLAY_DIR: cassetteDir,
      ICU_RECORD_MISSING: "1",
    };
  }
  return { ICU_REPLAY_DIR: cassetteDir, INTERVALS_API_KEY: "" };
}

let spent = 0;

async function execute(spec: RunSpec): Promise<RunRecord> {
  const { evalCase, model, effort, trial } = spec;
  const runDir = join(
    resultsDir,
    "runs",
    evalCase.id,
    `${model}__${effort}`,
    `t${trial}`
  );
  mkdirSync(runDir, { recursive: true });
  const captureFile = join(runDir, "writes.jsonl");
  const cassetteDir = join(evalCase.dir, "cassette");
  if (record) mkdirSync(cassetteDir, { recursive: true });
  const workspace = buildWorkspace({
    repoRoot: REPO_ROOT,
    caseDir: evalCase.dir,
    subagentModel,
  });
  try {
    const agent = await runAgent({
      evalCase,
      workspace,
      runDir,
      model,
      effort,
      env: {
        ICU_NOW: evalCase.scenarioDate,
        ICU_CAPTURE_FILE: captureFile,
        ...cassetteEnv(cassetteDir),
      },
      allowedDomains: live ? ["intervals.icu"] : [],
      writableDirs: live ? [runDir, cassetteDir] : [runDir],
      maxBudgetUsd: Number(args["run-budget-usd"]),
    });
    config.claudeVersion ??= agent.claudeVersion;
    const run = {
      evalCase,
      messages: agent.messages,
      ...extract(agent.messages),
      writes: readJsonl<CapturedWrite>(captureFile),
      misses: readJsonl<ReplayMiss>(join(runDir, "misses.jsonl")),
      error: agent.error,
    };
    const grades = await gradeRun(run, { judgeModel: args["judge-model"]! });
    const judgeCostUsd = grades.reduce((s, g) => s + (g.costUsd ?? 0), 0);
    const runScore = score(grades);
    const rec: RunRecord = {
      caseId: evalCase.id,
      model,
      effort,
      trial,
      score: runScore,
      passed: runScore === 1,
      grades,
      costUsd: agent.costUsd,
      judgeCostUsd,
      turns: agent.turns,
      durationMs: agent.durationMs,
      error: agent.error,
      runDir,
    };
    spent += agent.costUsd + judgeCostUsd;
    writeFileSync(join(runDir, "final.md"), run.finalText);
    writeFileSync(
      join(runDir, "run.json"),
      JSON.stringify({ ...rec, modelUsage: agent.modelUsage }, null, 2)
    );
    return rec;
  } finally {
    if (args["keep-workspace"]) console.log(`  workspace kept: ${workspace}`);
    else rmSync(workspace, { recursive: true, force: true });
  }
}

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}

function printRun(r: RunRecord): void {
  const status = r.passed ? "PASS" : "FAIL";
  console.log(
    `${status} ${r.caseId} ${r.model}/${r.effort} t${r.trial}  score ${fmt(r.score)}  $${fmt(r.costUsd)}  ${r.turns} turns  ${Math.round(r.durationMs / 1000)}s${r.error ? `  [${r.error}]` : ""}`
  );
  for (const g of r.grades.filter((g) => !g.passed)) {
    console.log(
      `     ✗ ${g.name}${g.weight === 0 ? " (info)" : ""}: ${g.explanation}`
    );
  }
}

// Bounded pool; the cost ceiling is checked before each launch, so overrun
// is at most the runs in flight.
const records: RunRecord[] = [];
const skipped: RunSpec[] = [];
const queue = [...specs];
async function worker(): Promise<void> {
  for (let spec = queue.shift(); spec; spec = queue.shift()) {
    if (spent >= maxCost) {
      skipped.push(spec);
      continue;
    }
    const rec = await execute(spec);
    records.push(rec);
    printRun(rec);
  }
}

console.log(`${specs.length} run(s) → ${resultsDir}`);
await Promise.all(
  Array.from({ length: Math.max(1, Number(args.concurrency)) }, worker)
);

// One cell per case × model × effort; pass^k = every trial passed.
const cells = new Map<string, RunRecord[]>();
for (const r of records) {
  const key = `${r.caseId}\t${r.model}\t${r.effort}`;
  cells.set(key, [...(cells.get(key) ?? []), r]);
}
const summary = [...cells.entries()]
  .map(([key, runs]) => {
    const [caseId, model, effort] = key.split("\t");
    const mean = (f: (r: RunRecord) => number) =>
      runs.reduce((s, r) => s + f(r), 0) / runs.length;
    return {
      caseId,
      model,
      effort,
      trials: runs.length,
      meanScore: mean((r) => r.score),
      passRate: mean((r) => (r.passed ? 1 : 0)),
      passAll: runs.every((r) => r.passed),
      meanCostUsd: mean((r) => r.costUsd),
      meanTurns: mean((r) => r.turns),
      meanDurationS: mean((r) => r.durationMs / 1000),
    };
  })
  .sort((a, b) =>
    `${a.caseId}${a.model}${a.effort}`.localeCompare(
      `${b.caseId}${b.model}${b.effort}`
    )
  );

writeFileSync(join(resultsDir, "config.json"), JSON.stringify(config, null, 2));
writeFileSync(
  join(resultsDir, "summary.json"),
  JSON.stringify(
    {
      ...config,
      partial: skipped.length > 0,
      skippedRuns: skipped.length,
      totalCostUsd: spent,
      cells: summary,
      runs: records.map(({ grades, ...r }) => ({
        ...r,
        grades: grades.map(({ name, passed, weight, explanation }) => ({
          name,
          passed,
          weight,
          explanation,
        })),
      })),
    },
    null,
    2
  )
);

console.log("\nCASE\tMODEL\tEFFORT\tSCORE\tPASS%\tPASS^k\t$/RUN\tTURNS");
for (const c of summary) {
  console.log(
    `${c.caseId}\t${c.model}\t${c.effort}\t${fmt(c.meanScore)}\t${Math.round(c.passRate * 100)}%\t${c.passAll ? "yes" : "no"}\t${fmt(c.meanCostUsd)}\t${fmt(c.meanTurns, 1)}`
  );
}
console.log(
  `\n$${fmt(spent)} total${skipped.length ? ` · ${skipped.length} run(s) skipped at the cost ceiling` : ""} · ${resultsDir}`
);
if (config.skillsDirty)
  console.log(
    "note: uncommitted changes under .claude/docs/agents/src/bin were evaluated"
  );
