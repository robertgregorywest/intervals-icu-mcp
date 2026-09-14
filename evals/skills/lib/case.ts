import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { graderOptions } from "../graders/index.js";
import type { EvalCase } from "./types.js";

function findCaseFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) out.push(...findCaseFiles(path));
    else if (entry === "case.yaml") out.push(path);
  }
  return out;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
}

function loadCase(file: string): EvalCase {
  const raw = parse(readFileSync(file, "utf8")) as Partial<EvalCase>;
  for (const field of ["id", "skill", "scenarioDate", "prompt"] as const) {
    if (!raw[field]) throw new Error(`${file}: missing \`${field}\``);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw.scenarioDate))) {
    throw new Error(`${file}: scenarioDate must be YYYY-MM-DD`);
  }
  if (!Array.isArray(raw.graders) || raw.graders.length === 0) {
    throw new Error(`${file}: needs at least one grader`);
  }
  raw.graders.forEach((spec, i) => {
    try {
      graderOptions(spec);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${file}: graders[${i}] ${message}`);
    }
  });
  return {
    ...raw,
    scenarioDate: String(raw.scenarioDate),
    dir: dirname(file),
  } as EvalCase;
}

export interface CaseFilter {
  skill?: string;
  caseGlob?: string;
  tag?: string;
}

export function loadCases(root: string, filter: CaseFilter = {}): EvalCase[] {
  if (!existsSync(root)) throw new Error(`No scenarios directory at ${root}`);
  const glob = filter.caseGlob ? globToRegExp(filter.caseGlob) : null;
  const cases = findCaseFiles(root).map(loadCase);
  const ids = new Set<string>();
  for (const c of cases) {
    if (ids.has(c.id)) throw new Error(`Duplicate case id: ${c.id}`);
    ids.add(c.id);
  }
  return cases
    .filter((c) => !filter.skill || c.skill === filter.skill)
    .filter((c) => !glob || glob.test(c.id))
    .filter((c) => !filter.tag || (c.tags ?? []).includes(filter.tag))
    .sort((a, b) => a.id.localeCompare(b.id));
}
