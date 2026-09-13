import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunArtifacts, ToolUse } from "./types.js";

type Block = Record<string, unknown>;

function blocks(content: unknown): Block[] {
  return Array.isArray(content)
    ? content.filter((b): b is Block => typeof b === "object" && b !== null)
    : [];
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  return blocks(content)
    .map((b) => (typeof b.text === "string" ? b.text : ""))
    .join("\n");
}

export interface Extracted {
  toolUses: ToolUse[];
  toolResults: Map<string, string>;
  finalText: string;
}

export function extract(messages: SDKMessage[]): Extracted {
  const toolUses: ToolUse[] = [];
  const toolResults = new Map<string, string>();
  let finalText = "";
  for (const m of messages) {
    if (m.type === "assistant") {
      for (const b of blocks(m.message.content)) {
        if (b.type !== "tool_use") continue;
        toolUses.push({
          id: String(b.id),
          name: String(b.name),
          input: (b.input ?? {}) as Record<string, unknown>,
          parentToolUseId: m.parent_tool_use_id,
        });
      }
    } else if (m.type === "user") {
      for (const b of blocks(m.message.content)) {
        if (b.type === "tool_result") {
          toolResults.set(String(b.tool_use_id), resultText(b.content));
        }
      }
    } else if (m.type === "result" && m.subtype === "success") {
      finalText = m.result;
    }
  }
  return { toolUses, toolResults, finalText };
}

/** Every Bash command the run issued, subagents and forks included. */
export function bashCommands(run: RunArtifacts): string[] {
  return run.toolUses
    .filter((t) => t.name === "Bash")
    .map((t) => String(t.input.command ?? ""));
}

/** `./bin/icu <tool>` subcommands, in call order. */
export function icuCalls(run: RunArtifacts): string[] {
  const calls: string[] = [];
  for (const cmd of bashCommands(run)) {
    for (const m of cmd.matchAll(/bin\/icu\s+([a-z_]+)([^|;&]*)/g)) {
      calls.push(`${m[1]}${m[2]}`.trim());
    }
  }
  return calls;
}

/**
 * The text a grader reads. `skillReport` is what the case's skill handed
 * back through the Skill tool (a forked skill's report); it falls back to the
 * final reply when the skill ran inline or was invoked by slash command.
 */
export function targetText(run: RunArtifacts, target: unknown): string {
  if (target === "skillReport") {
    const call = run.toolUses.find(
      (t) =>
        t.name === "Skill" && skillMatches(t.input.skill, run.evalCase.skill)
    );
    const report = call ? run.toolResults.get(call.id) : undefined;
    if (report) return report;
  }
  return run.finalText;
}

export function skillMatches(value: unknown, skill: string): boolean {
  return (
    typeof value === "string" &&
    (value === skill || value.endsWith(`:${skill}`))
  );
}
