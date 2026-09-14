// Compares two skill-eval result sets (issue #20) cell by cell: a baseline
// (say, the current model's stored run) against a candidate (the same suite
// on a new model, effort level or skill edit). Flags every cell whose mean
// score fell by more than --threshold, and the graders that fell with it.
//
//   npm run eval:compare -- <baseline> <candidate> [--threshold 0.1]
//
// Each side is a results directory, or its timestamp name under
// docs/personal/evals/results. Exits 1 when any cell regressed.

import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const REPO_ROOT = resolve(import.meta.dirname, "../..");

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    threshold: { type: "string", default: "0.1" },
    results: { type: "string", default: "docs/personal/evals/results" },
  },
});
if (positionals.length !== 2) {
  throw new Error(
    "usage: npm run eval:compare -- <baseline> <candidate> [--threshold 0.1]"
  );
}
const threshold = Number(args.threshold);

interface Cell {
  caseId: string;
  model: string;
  effort: string;
  trials: number;
  meanScore: number;
  passRate: number;
  passAll: boolean;
  meanCostUsd: number;
  meanTurns: number;
}

interface Run {
  caseId: string;
  model: string;
  effort: string;
  grades: Array<{ name: string; passed: boolean; weight: number }>;
}

interface Summary {
  gitSha: string;
  skillsDirty: boolean;
  models: string[];
  efforts: string[];
  judgeModel: string;
  partial: boolean;
  cells: Cell[];
  runs: Run[];
}

function load(ref: string): { label: string; summary: Summary } {
  const dir = existsSync(ref)
    ? resolve(ref)
    : resolve(REPO_ROOT, args.results, ref);
  const file = join(dir, "summary.json");
  if (!existsSync(file)) throw new Error(`No summary.json in ${dir}`);
  return {
    label: basename(dir),
    summary: JSON.parse(readFileSync(file, "utf8")) as Summary,
  };
}

const base = load(positionals[0]);
const cand = load(positionals[1]);
const A = base.summary;
const B = cand.summary;

// Cells pair on case × model × effort. When the two sides swept a different
// single model (or effort), that dimension is the thing being compared, so
// cells pair across it instead.
function pairsOn(dim: "models" | "efforts"): boolean {
  const a = A[dim];
  const b = B[dim];
  if (a.length === b.length && a.every((x) => b.includes(x))) return true;
  if (a.length === 1 && b.length === 1) return false;
  throw new Error(
    `${dim} differ (${a.join(",")} vs ${b.join(",")}) — compare the same ${dim}, or one each`
  );
}
const byModel = pairsOn("models");
const byEffort = pairsOn("efforts");

function key(c: { caseId: string; model: string; effort: string }): string {
  return [c.caseId, byModel ? c.model : "", byEffort ? c.effort : ""].join(
    "\t"
  );
}

function label(k: string): string {
  return k.split("\t").filter(Boolean).join(" ");
}

/** Pass rate per grader over a cell's trials. */
function graderRates(s: Summary, k: string): Map<string, number> {
  const tally = new Map<string, { pass: number; total: number }>();
  for (const r of s.runs.filter((r) => key(r) === k)) {
    for (const g of r.grades) {
      const t = tally.get(g.name) ?? { pass: 0, total: 0 };
      t.pass += g.passed ? 1 : 0;
      t.total += 1;
      tally.set(g.name, t);
    }
  }
  return new Map([...tally].map(([n, t]) => [n, t.pass / t.total]));
}

const fmt = (n: number, d = 2) => n.toFixed(d);
const signed = (n: number, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

const cellsA = new Map(A.cells.map((c) => [key(c), c]));
const cellsB = new Map(B.cells.map((c) => [key(c), c]));
const keys = [...new Set([...cellsA.keys(), ...cellsB.keys()])].sort();

console.log(
  `baseline   ${base.label}  ${A.models.join(",")} / ${A.efforts.join(",")}  @${A.gitSha.slice(0, 7)}${A.skillsDirty ? " (dirty)" : ""}${A.partial ? " PARTIAL" : ""}`
);
console.log(
  `candidate  ${cand.label}  ${B.models.join(",")} / ${B.efforts.join(",")}  @${B.gitSha.slice(0, 7)}${B.skillsDirty ? " (dirty)" : ""}${B.partial ? " PARTIAL" : ""}`
);
if (A.judgeModel !== B.judgeModel) {
  console.log(
    `note: judge models differ (${A.judgeModel} vs ${B.judgeModel}) — llmRubric grades are not like for like`
  );
}

const rows: string[][] = [["CELL", "SCORE", "Δ", "PASS^k", "$/RUN", "Δ$", ""]];
const regressions: string[] = [];
const onlyOne: string[] = [];
for (const k of keys) {
  const a = cellsA.get(k);
  const b = cellsB.get(k);
  if (!a || !b) {
    onlyOne.push(`${label(k)} (only in ${a ? "baseline" : "candidate"})`);
    continue;
  }
  const delta = b.meanScore - a.meanScore;
  const regressed = delta < -threshold;
  if (regressed) regressions.push(k);
  rows.push([
    label(k),
    `${fmt(a.meanScore)} → ${fmt(b.meanScore)}`,
    signed(delta),
    `${a.passAll ? "yes" : "no"} → ${b.passAll ? "yes" : "no"}`,
    `${fmt(a.meanCostUsd)} → ${fmt(b.meanCostUsd)}`,
    signed(b.meanCostUsd - a.meanCostUsd),
    regressed ? "▼ REGRESSED" : delta > threshold ? "▲" : "",
  ]);
}

const paired = keys.filter((k) => cellsA.has(k) && cellsB.has(k));
if (paired.length === 0) {
  console.log(`\nno cells in common — unpaired: ${onlyOne.join("; ")}`);
  process.exit(0);
}

const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
console.log("");
for (const r of rows) {
  console.log(
    r
      .map((c, i) => c.padEnd(widths[i]))
      .join("  ")
      .trimEnd()
  );
}
if (onlyOne.length) console.log(`\nunpaired: ${onlyOne.join("; ")}`);

for (const k of regressions) {
  const ra = graderRates(A, k);
  const rb = graderRates(B, k);
  const fell = [...rb]
    .filter(([n, rate]) => rate < (ra.get(n) ?? 0))
    .map(([n, rate]) => `${n} ${pct(ra.get(n) ?? 0)} → ${pct(rate)}`);
  console.log(
    `\n▼ ${label(k)}: ${fell.length ? fell.join("; ") : "no single grader fell — mixed trial results"}`
  );
}

// Roll-up over the paired cells only, so both sides average the same cases.
function rollup(cells: Map<string, Cell>): string {
  const cs = paired.map((k) => cells.get(k)!);
  const mean = (f: (c: Cell) => number) =>
    cs.reduce((s, c) => s + f(c), 0) / Math.max(1, cs.length);
  return `score ${fmt(mean((c) => c.meanScore))}  pass^k ${cs.filter((c) => c.passAll).length}/${cs.length}  $/run ${fmt(mean((c) => c.meanCostUsd))}  turns ${fmt(
    mean((c) => c.meanTurns),
    1
  )}`;
}
console.log(`\nbaseline   ${rollup(cellsA)}`);
console.log(`candidate  ${rollup(cellsB)}`);
console.log(
  regressions.length
    ? `\n${regressions.length} cell(s) fell by more than ${threshold}`
    : `\nno cell fell by more than ${threshold}`
);
process.exit(regressions.length ? 1 : 0);
