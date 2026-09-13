import { query } from "@anthropic-ai/claude-agent-sdk";
import type { GradeOutcome } from "./types.js";

const VOTES = 3;

const SYSTEM = `You grade one output from an AI cycling coach against a rubric.
Judge only what the rubric asks; formatting differences do not decide the verdict.
Reply with a single JSON object and nothing else:
{"verdict": "PASS" | "FAIL", "reason": "<one sentence>"}`;

interface Vote {
  verdict: "PASS" | "FAIL" | "UNPARSEABLE";
  reason: string;
  costUsd: number;
}

async function vote(model: string, prompt: string): Promise<Vote> {
  let text = "";
  let costUsd = 0;
  for await (const m of query({
    prompt,
    options: {
      model,
      systemPrompt: SYSTEM,
      settingSources: [],
      maxTurns: 1,
      permissionMode: "dontAsk",
      allowedTools: [],
    },
  })) {
    if (m.type === "result") {
      costUsd = m.total_cost_usd;
      if (m.subtype === "success") text = m.result;
    }
  }
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  try {
    const parsed = JSON.parse(json ?? "") as {
      verdict?: string;
      reason?: string;
    };
    const verdict = parsed.verdict?.toUpperCase();
    if (verdict === "PASS" || verdict === "FAIL") {
      return { verdict, reason: parsed.reason ?? "", costUsd };
    }
  } catch {
    // fall through
  }
  return { verdict: "UNPARSEABLE", reason: text.slice(0, 200), costUsd };
}

/** Majority of three votes from the pinned judge model. */
export async function judge(
  model: string,
  criteria: string,
  output: string
): Promise<GradeOutcome> {
  const prompt = `## Rubric\n\n${criteria.trim()}\n\n## Output to grade\n\n${output.trim() || "(empty)"}`;
  const votes = await Promise.all(
    Array.from({ length: VOTES }, () => vote(model, prompt))
  );
  const passes = votes.filter((v) => v.verdict === "PASS").length;
  const passed = passes * 2 > VOTES;
  const deciding = votes.find((v) => (v.verdict === "PASS") === passed);
  return {
    passed,
    explanation: `${passes}/${VOTES} PASS — ${deciding?.reason ?? votes[0].reason}`,
    costUsd: votes.reduce((s, v) => s + v.costUsd, 0),
  };
}
