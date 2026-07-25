import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTemplate, type WorkoutTemplate } from "./template.js";

/**
 * Workout templates live at `templates/workouts/`, not under `src/`,
 * so the same module-relative path resolves in every context:
 *
 *   repo    src/services/workout-library/  -> ../../../templates/workouts
 *   built   dist/services/workout-library/ -> ../../../templates/workouts
 *   bundle  dist/services/workout-library/ -> ../../../templates/workouts
 *
 * That means the MCP server reads the file you just edited — no build step and
 * no reconnect — while the packed bundle still finds its shipped copy.
 */
export const TEMPLATES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../templates/workouts"
);

export function loadTemplates(dir: string = TEMPLATES_DIR): WorkoutTemplate[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const templates: WorkoutTemplate[] = [];
  const seen = new Map<string, string>();

  for (const file of files) {
    const template = parseTemplate(
      readFileSync(join(dir, file), "utf8"),
      `templates/${file}`
    );
    const previous = seen.get(template.seedId);
    if (previous) {
      throw new Error(
        `Duplicate seedId "${template.seedId}" in templates/${file} — already used by ${previous}. ` +
          "seedId is the identity used to match the library workout, so it must be unique."
      );
    }
    seen.set(template.seedId, `templates/${file}`);
    templates.push(template);
  }

  return templates;
}
