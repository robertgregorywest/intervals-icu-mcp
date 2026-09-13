import { targetText } from "../lib/transcript.js";
import type { Grader } from "../lib/types.js";

const WATERMARK =
  /^(reviewed through: \d{4}-\d{2}-\d{2}|skipped: no key session in .+)$/i;

/**
 * The report ends on the watermark line the caller advances the log to —
 * optionally a specific one (`expect:`).
 */
export const watermarkLine: Grader = (spec, run) => {
  const lines = targetText(run, spec.target ?? "skillReport")
    .split("\n")
    .map((l) => l.replace(/[*_`>]/g, "").trim())
    .filter(Boolean);
  const last = lines.at(-1) ?? "";
  if (!WATERMARK.test(last)) {
    return {
      passed: false,
      explanation: `last line is "${last.slice(0, 80)}"`,
    };
  }
  const expected = spec.expect ? String(spec.expect).toLowerCase() : null;
  return {
    passed: !expected || last.toLowerCase().includes(expected),
    explanation: `last line "${last}"`,
  };
};

/** Findings only — no raw comparison JSON, no full session tables. */
export const noRawDump: Grader = (spec, run) => {
  const text = targetText(run, spec.target ?? "skillReport");
  const maxTableRows = Number(spec.maxTableRows ?? 8);
  const tableRows = text
    .split("\n")
    .filter((l) => l.trim().startsWith("|")).length;
  const jsonBlob = /\{[^{}]*"[a-zA-Z]+"\s*:[^{}]{200,}\}/.test(text);
  const problems = [
    ...(jsonBlob ? ["contains a raw JSON object"] : []),
    ...(tableRows > maxTableRows ? [`${tableRows} table rows`] : []),
  ];
  return {
    passed: problems.length === 0,
    explanation: problems.length ? problems.join("; ") : "findings only",
  };
};
