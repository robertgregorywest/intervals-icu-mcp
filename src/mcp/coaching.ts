import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FILES = [
  { file: "philosophy.md", heading: "Philosophy" },
  { file: "season.md", heading: "Season" },
  { file: "athlete.md", heading: "Athlete" },
] as const;

const MAX_CHARS = 20_000;

const FALLBACK_GENERIC_BLURB = `## Coaching context

No coaching documents are configured. To customize this server's coaching behavior — your training philosophy, current season, and athlete profile — invoke the \`setup_coaching\` MCP prompt to start a guided interview, or hand-author files at \`~/.intervals-icu-mcp/coaching/\` (\`philosophy.md\`, \`season.md\`, \`athlete.md\`).

In the meantime: reason about intensity in %FTP or zones from \`get_athlete\`, emit absolute watts at the API boundary, and check \`list_workout_library\` before composing workouts ad-hoc.`;

export interface LoadCoachingOptions {
  dir?: string;
}

export async function loadCoachingInstructions(
  opts: LoadCoachingOptions = {}
): Promise<string> {
  const dir =
    opts.dir ??
    process.env.INTERVALS_COACHING_DIR ??
    join(homedir(), ".intervals-icu-mcp", "coaching");

  const sections: string[] = [];
  for (const { file, heading } of FILES) {
    const path = join(dir, file);
    try {
      const content = (await fs.readFile(path, "utf8")).trim();
      if (content) {
        sections.push(`## ${heading}\n\n${content}`);
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        process.stderr.write(
          `[intervals-icu-mcp] Skipping ${path}: ${(err as Error).message}\n`
        );
      }
    }
  }

  if (sections.length === 0) {
    return FALLBACK_GENERIC_BLURB;
  }

  let combined = sections.join("\n\n");
  if (combined.length > MAX_CHARS) {
    process.stderr.write(
      `[intervals-icu-mcp] Coaching docs exceed ${MAX_CHARS} chars (${combined.length}); truncating.\n`
    );
    combined =
      combined.slice(0, MAX_CHARS) +
      "\n\n[truncated — shorten coaching docs to fit within the size budget]";
  }
  return combined;
}

export const COACHING_FALLBACK_BLURB = FALLBACK_GENERIC_BLURB;
export const COACHING_MAX_CHARS = MAX_CHARS;
