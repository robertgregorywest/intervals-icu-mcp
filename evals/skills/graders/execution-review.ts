import { z } from "zod";
import { defineGrader, target } from "../lib/grader.js";
import { targetText } from "../lib/transcript.js";

const WATERMARK =
  /^(reviewed through: \d{4}-\d{2}-\d{2}|skipped: no key session in .+)$/i;

/**
 * The report ends on the watermark line the caller advances the log to —
 * optionally a specific one (`expect:`).
 */
export const watermarkLine = defineGrader(
  z.strictObject({ expect: z.string().optional(), target }),
  (o, run) => {
    const lines = targetText(run, o.target ?? "skillReport")
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
    const expected = o.expect?.toLowerCase() ?? null;
    return {
      passed: !expected || last.toLowerCase().includes(expected),
      explanation: `last line "${last}"`,
    };
  }
);

/** End of the bracketed value opening at `start`, or -1 if unbalanced. */
function closingBracket(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** An object with a few keys, or an array holding objects — data, not prose. */
function isDump(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((v) => typeof v === "object" && v !== null);
  }
  return (
    typeof value === "object" &&
    value !== null &&
    Object.keys(value).length >= 3
  );
}

/** The first raw JSON value in the text — fenced or inline, nested or not. */
function rawJson(text: string): string | null {
  if (/```json\b/i.test(text)) return "a ```json block";
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{" && text[i] !== "[") continue;
    const end = closingBracket(text, i);
    if (end === -1) continue;
    try {
      if (isDump(JSON.parse(text.slice(i, end + 1)))) {
        return `raw JSON: ${text.slice(i, i + 40).replace(/\s+/g, " ")}…`;
      }
      i = end;
    } catch {
      // Brackets in prose; keep scanning inside them.
    }
  }
  return null;
}

/** Findings only — no raw comparison JSON, no full session tables. */
export const noRawDump = defineGrader(
  z.strictObject({ maxTableRows: z.number().int().optional(), target }),
  (o, run) => {
    const text = targetText(run, o.target ?? "skillReport");
    const maxTableRows = o.maxTableRows ?? 8;
    const tableRows = text
      .split("\n")
      .filter((l) => l.trim().startsWith("|")).length;
    const json = rawJson(text);
    const problems = [
      ...(json ? [json] : []),
      ...(tableRows > maxTableRows ? [`${tableRows} table rows`] : []),
    ];
    return {
      passed: problems.length === 0,
      explanation: problems.length ? problems.join("; ") : "findings only",
    };
  }
);

const HELD = /\bheld\b|\bnot rais|\bone-off\b|\bseen once\b/i;

/**
 * Each expected session lands where the ground truth says: `reported` — the
 * report names it (`match:`, a regex for how it may be named) outside any
 * line marking it held; `held` — it is not raised: every line naming it,
 * if any, marks it held.
 */
export const sessionsDispositioned = defineGrader(
  z.strictObject({
    sessions: z
      .array(
        z.strictObject({
          match: z.string(),
          as: z.enum(["reported", "held"]),
        })
      )
      .min(1),
    target,
  }),
  (o, run) => {
    const lines = targetText(run, o.target ?? "skillReport").split("\n");
    const problems: string[] = [];
    for (const s of o.sessions) {
      const re = new RegExp(s.match, "i");
      const naming = lines.filter((l) => re.test(l));
      const raised = naming.some((l) => !HELD.test(l));
      if (s.as === "reported" && !raised) {
        problems.push(
          naming.length
            ? `/${s.match}/ only marked held, expected reported`
            : `/${s.match}/ not reported`
        );
      }
      if (s.as === "held" && raised) {
        problems.push(`/${s.match}/ raised, expected held`);
      }
    }
    return {
      passed: problems.length === 0,
      explanation: problems.length
        ? problems.join("; ")
        : `${o.sessions.length} session(s) dispositioned as expected`,
    };
  }
);
