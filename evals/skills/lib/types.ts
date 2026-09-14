import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { z } from "zod";
import type { CapturedWrite, ReplayMiss } from "../../../src/cassette.js";

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

/**
 * `skills` runs the case as written; `no-skills` is the baseline arm, the
 * same case with `.claude/skills` and `.claude/agents` removed — to spot a
 * skill the model no longer needs.
 */
export type Arm = "skills" | "no-skills";

/** One grader entry in a case's `graders:` list, as written in case.yaml. */
export interface GraderSpec {
  type: string;
  name?: string;
  /** Relative weight in the run's score; 0 reports without scoring. */
  weight?: number;
  /** Grader-specific options, checked against its schema at load. */
  [option: string]: unknown;
}

/** A scenario: a real moment in the athlete's history, frozen. */
export interface EvalCase {
  id: string;
  skill: string;
  description?: string;
  /** "Today" for the run — pinned in the CLI and stated to the agent. */
  scenarioDate: string;
  prompt: string;
  /** Scripted replies sent as later user turns, one per turn. */
  followups?: string[];
  maxTurns?: number;
  timeoutSeconds?: number;
  tags?: string[];
  graders: GraderSpec[];
  /** Absolute path of the case directory. */
  dir: string;
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
  /** Set when the call was made inside a subagent or forked skill. */
  parentToolUseId: string | null;
}

/** Everything a grader may look at after a run. */
export interface RunArtifacts {
  evalCase: EvalCase;
  messages: SDKMessage[];
  toolUses: ToolUse[];
  /** Tool-result text keyed by tool_use id. */
  toolResults: Map<string, string>;
  /** The session's final reply. */
  finalText: string;
  writes: CapturedWrite[];
  misses: ReplayMiss[];
  error: string | null;
}

export interface GradeOutcome {
  passed: boolean;
  explanation: string;
  /** Judge spend, for llm graders. */
  costUsd?: number;
}

export interface GradeResult extends GradeOutcome {
  name: string;
  type: string;
  weight: number;
}

export interface GraderContext {
  judgeModel: string;
  arm: Arm;
}

export interface GraderDef<O> {
  options: z.ZodType<O>;
  grade(
    opts: O,
    run: RunArtifacts,
    ctx: GraderContext
  ): GradeOutcome | Promise<GradeOutcome>;
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}
