// Lists the skill-eval scenarios (issue #20): what each captures, what it
// checks, and whether it has a cassette to replay.
//
//   npm run eval:cases [-- --skill plan-workout] [--tag seed] [--case pw-*]

import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadCases } from "./lib/case.js";

const REPO_ROOT = resolve(import.meta.dirname, "../..");

const { values: args } = parseArgs({
  options: {
    skill: { type: "string" },
    tag: { type: "string" },
    case: { type: "string" },
    scenarios: { type: "string", default: "docs/personal/evals/scenarios" },
  },
});

const cases = loadCases(resolve(REPO_ROOT, args.scenarios), {
  skill: args.skill,
  tag: args.tag,
  caseGlob: args.case,
});

const bySkill = new Map<string, typeof cases>();
for (const c of cases)
  bySkill.set(c.skill, [...(bySkill.get(c.skill) ?? []), c]);

for (const [skill, group] of [...bySkill].sort()) {
  console.log(`\n${skill} (${group.length})`);
  for (const c of group) {
    const cassette = join(c.dir, "cassette");
    const recorded = existsSync(cassette)
      ? `${readdirSync(cassette).length} recorded`
      : "NO CASSETTE — run with --record";
    const tags = c.tags?.length ? `  [${c.tags.join(", ")}]` : "";
    console.log(`  ${c.id}  ${c.scenarioDate}${tags}  ${recorded}`);
    console.log(`    prompt: ${c.prompt}`);
    if (c.description) {
      console.log(`    ${c.description.trim().split("\n")[0]}`);
    }
    const graders = c.graders.map((g) =>
      g.name ? `${String(g.name)} (${g.type})` : g.type
    );
    console.log(`    graders: ${graders.join(", ")}`);
  }
}
console.log(`\n${cases.length} case(s)`);
