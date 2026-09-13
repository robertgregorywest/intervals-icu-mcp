import { judge } from "../lib/judge.js";
import { icuCalls, skillMatches, targetText } from "../lib/transcript.js";
import type { Grader } from "../lib/types.js";

// Tiers from docs/agents/icu-cli.md.
const READ_ONLY = /^(get_|list_|compute_|compare_|describe)/;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/** The case's skill (or `skill:`) ran — by Skill tool or slash command. */
export const skillInvoked: Grader = (spec, run) => {
  const skill = String(spec.skill ?? run.evalCase.skill);
  const viaTool = run.toolUses.some(
    (t) => t.name === "Skill" && skillMatches(t.input.skill, skill)
  );
  // A slash-invoked forked skill runs out of band: the transcript holds only
  // its report, as an assistant message carrying `local_command_source`.
  const viaSlash =
    run.evalCase.prompt.trimStart().startsWith(`/${skill}`) &&
    run.messages.some((m) => "local_command_source" in m);
  return {
    passed: viaTool || viaSlash,
    explanation: viaTool
      ? `Skill tool invoked ${skill}`
      : viaSlash
        ? `invoked as /${skill}`
        : `${skill} never invoked`,
  };
};

/**
 * Only read-only CLI commands, and nothing captured as a write. A forked
 * skill's Bash calls never reach the transcript, so there the captured
 * writes are the whole evidence.
 */
export const readOnly: Grader = (_spec, run) => {
  const calls = icuCalls(run);
  const offending = calls.filter(
    (c) => !READ_ONLY.test(c) || /--yes\b/.test(c)
  );
  const problems = [
    ...offending.map((c) => `ran ${c.split(" ")[0]}`),
    ...run.writes.map((w) => `wrote ${w.method} ${w.path}`),
  ];
  return {
    passed: problems.length === 0,
    explanation: problems.length
      ? problems.join("; ")
      : calls.length
        ? "read-only"
        : "no writes captured (CLI calls not visible)",
  };
};

/** Reported, never scored: requests the recorded scenario could not answer. */
export const noReplayMisses: Grader = (_spec, run) => ({
  passed: run.misses.length === 0,
  explanation: run.misses.length
    ? `${run.misses.length} unrecorded: ${[...new Set(run.misses.map((m) => m.key))].join(", ")}`
    : "every request was in the cassette",
});

/** `pattern` found in (or, with `match: not_contains`, absent from) the target. */
export const regex: Grader = (spec, run) => {
  const re = new RegExp(String(spec.pattern), String(spec.flags ?? ""));
  const found = re.test(targetText(run, spec.target));
  const wantAbsent = spec.match === "not_contains";
  return {
    passed: wantAbsent ? !found : found,
    explanation: `/${re.source}/ ${found ? "found" : "not found"}`,
  };
};

/** Every `mustMention` term appears in the target, and no `mustNotMention`. */
export const mentions: Grader = (spec, run) => {
  const text = targetText(run, spec.target).toLowerCase();
  const missing = strings(spec.mustMention).filter(
    (t) => !text.includes(t.toLowerCase())
  );
  const present = strings(spec.mustNotMention).filter((t) =>
    text.includes(t.toLowerCase())
  );
  const problems = [
    ...missing.map((t) => `missing "${t}"`),
    ...present.map((t) => `mentions "${t}"`),
  ];
  return {
    passed: problems.length === 0,
    explanation: problems.length ? problems.join("; ") : "mentions as expected",
  };
};

/** The run ended normally rather than on an error, turn cap or timeout. */
export const completed: Grader = (_spec, run) => ({
  passed: run.error === null && run.finalText.length > 0,
  explanation: run.error ?? (run.finalText ? "completed" : "no final reply"),
});

export const llmRubric: Grader = (spec, run, ctx) =>
  judge(
    String(spec.judgeModel ?? ctx.judgeModel),
    String(spec.criteria ?? ""),
    targetText(run, spec.target)
  );
