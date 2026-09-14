import { z } from "zod";
import type {
  GradeOutcome,
  GraderContext,
  GraderDef,
  RunArtifacts,
} from "./types.js";

/**
 * A grader and the options a case may give it. The options are checked when
 * the case loads, so a typo in `case.yaml` fails before any money is spent.
 */
export function defineGrader<S extends z.ZodType>(
  options: S,
  grade: (
    opts: z.output<S>,
    run: RunArtifacts,
    ctx: GraderContext
  ) => GradeOutcome | Promise<GradeOutcome>
): GraderDef<z.output<S>> {
  return { options: options as z.ZodType<z.output<S>>, grade };
}

/** Which text a grader reads: the forked skill's report, or the final reply. */
export const target = z.enum(["skillReport", "final"]).optional();

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
