import type {
  GradeResult,
  GraderContext,
  GraderDef,
  GraderSpec,
  RunArtifacts,
} from "../lib/types.js";
import * as executionReview from "./execution-review.js";
import * as planWorkout from "./plan-workout.js";
import * as shared from "./shared.js";

// Each grader's options are its own; the map only needs to call them.
const GRADERS: Record<string, GraderDef<any>> = {
  ...shared,
  ...executionReview,
  ...planWorkout,
};

// Reported alongside the score but never part of it.
const INFO_ONLY = new Set(["noReplayMisses"]);

const COMMON = new Set(["type", "name", "weight"]);

/**
 * A spec's options, checked against its grader's schema. Throws a readable
 * message naming the bad option — `loadCases` calls this so a case fails at
 * load, not mid-sweep.
 */
export function graderOptions(spec: GraderSpec): unknown {
  const def = GRADERS[spec.type];
  if (!def) {
    throw new Error(
      `unknown grader type "${spec.type}" (one of ${Object.keys(GRADERS).join(", ")})`
    );
  }
  if (spec.name !== undefined && typeof spec.name !== "string") {
    throw new Error(`${spec.type}: name must be a string`);
  }
  if (
    spec.weight !== undefined &&
    (typeof spec.weight !== "number" || spec.weight < 0)
  ) {
    throw new Error(`${spec.type}: weight must be a number ≥ 0`);
  }
  const options = Object.fromEntries(
    Object.entries(spec).filter(([k]) => !COMMON.has(k))
  );
  const parsed = def.options.safeParse(options);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".") || "options"}: ${i.message}`
    );
    throw new Error(`${spec.type}: ${issues.join("; ")}`);
  }
  return parsed.data;
}

/**
 * The no-skills arm has no skill to invoke, so `skillInvoked` there reports
 * without scoring rather than failing every run.
 */
function weightOf(spec: GraderSpec, ctx: GraderContext): number {
  if (INFO_ONLY.has(spec.type)) return 0;
  if (ctx.arm === "no-skills" && spec.type === "skillInvoked") return 0;
  return spec.weight ?? 1;
}

export async function gradeRun(
  run: RunArtifacts,
  ctx: GraderContext
): Promise<GradeResult[]> {
  return Promise.all(
    run.evalCase.graders.map(async (spec, i): Promise<GradeResult> => {
      const head = {
        name: spec.name ?? `${spec.type}#${i}`,
        type: spec.type,
        weight: weightOf(spec, ctx),
      };
      try {
        const options = graderOptions(spec);
        return {
          ...head,
          ...(await GRADERS[spec.type].grade(options, run, ctx)),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          ...head,
          passed: false,
          explanation: `grader error: ${message}`,
        };
      }
    })
  );
}

/** Weighted fraction of scored graders that passed. */
export function score(grades: GradeResult[]): number {
  const scored = grades.filter((g) => g.weight > 0);
  const total = scored.reduce((s, g) => s + g.weight, 0);
  if (total === 0) return 0;
  return scored.reduce((s, g) => s + (g.passed ? g.weight : 0), 0) / total;
}

export function graderTypes(): string[] {
  return Object.keys(GRADERS);
}
