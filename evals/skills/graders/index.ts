import type {
  GradeResult,
  Grader,
  GraderContext,
  RunArtifacts,
} from "../lib/types.js";
import * as executionReview from "./execution-review.js";
import * as planWorkout from "./plan-workout.js";
import * as shared from "./shared.js";

const GRADERS: Record<string, Grader> = {
  ...shared,
  ...executionReview,
  ...planWorkout,
};

// Reported alongside the score but never part of it.
const INFO_ONLY = new Set(["noReplayMisses"]);

export async function gradeRun(
  run: RunArtifacts,
  ctx: GraderContext
): Promise<GradeResult[]> {
  return Promise.all(
    run.evalCase.graders.map(async (spec, i): Promise<GradeResult> => {
      const name = String(spec.name ?? `${spec.type}#${i}`);
      const weight = INFO_ONLY.has(spec.type) ? 0 : (spec.weight ?? 1);
      const grader = GRADERS[spec.type];
      if (!grader) {
        return {
          name,
          type: spec.type,
          weight,
          passed: false,
          explanation: `unknown grader type ${spec.type}`,
        };
      }
      try {
        return {
          name,
          type: spec.type,
          weight,
          ...(await grader(spec, run, ctx)),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          name,
          type: spec.type,
          weight,
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
