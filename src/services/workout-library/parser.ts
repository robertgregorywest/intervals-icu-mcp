import type { WorkoutSummary } from "./types.js";

/** Provenance marker written by sync. */
const TEMPLATE_MARKER_RE = /<!--\s*template:\s*[a-z0-9][a-z0-9-]*\s*-->/i;
/** Legacy marker from the retired seed/refresh path — stripped, never written. */
const LEGACY_RATIONALE_RE = /<!--\s*rationale\s*[\s\S]+?\s*-->/i;

const DURATION_RE = /(\d+)(km|mtr|h|m|s)(?![a-z])/gi;
const REPEAT_RE = /(?:^|\s)(\d+)x\s*$/;

/**
 * A step line. Intervals.icu accepts a dash with no following space
 * (`-Warm-up 5m 160w`), which workouts authored in its UI commonly use, so the
 * space is optional here. The negative class keeps a `---` rule from matching.
 */
const STEP_LINE_RE = /^\s*-\s*[^\s-]/;

export function stripMarkers(description: string): string {
  return description
    .replace(TEMPLATE_MARKER_RE, "")
    .replace(LEGACY_RATIONALE_RE, "")
    .trimEnd();
}

/** The step body of a line, or null when the line is not a step. */
function stepBody(line: string): string | null {
  if (!STEP_LINE_RE.test(line)) return null;
  return line.trim().replace(/^-\s*/, "");
}

/**
 * The human text preceding the first step or repeat header, markers removed.
 */
export function extractProse(description: string): string {
  const lines = stripMarkers(description).split(/\r?\n/);
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (stepBody(lines[i]) !== null || REPEAT_RE.test(lines[i].trim())) {
      end = i;
      break;
    }
  }
  return lines.slice(0, end).join("\n").trim();
}

/**
 * The template's `purpose`: sync renders it as the first paragraph of the
 * description, so it is the first blank-line-delimited block of the prose.
 */
export function extractPurpose(description: string): string | undefined {
  const prose = extractProse(description);
  if (!prose) return undefined;
  const first = prose.split(/\n\s*\n/)[0]?.trim();
  return first || undefined;
}

export function hasTemplateMarker(description: string): boolean {
  return TEMPLATE_MARKER_RE.test(description ?? "");
}

interface ParsedStep {
  durationSeconds: number | null;
}

function parseDuration(token: string): {
  seconds: number | null;
  hasDistance: boolean;
} {
  let seconds = 0;
  let matched = false;
  let hasDistance = false;
  for (const m of token.matchAll(DURATION_RE)) {
    const value = Number(m[1]);
    const unit = m[2].toLowerCase();
    matched = true;
    switch (unit) {
      case "h":
        seconds += value * 3600;
        break;
      case "m":
        seconds += value * 60;
        break;
      case "s":
        seconds += value;
        break;
      case "km":
      case "mtr":
        hasDistance = true;
        break;
    }
  }
  return { seconds: matched && !hasDistance ? seconds : null, hasDistance };
}

function parseStepLine(line: string): ParsedStep | null {
  const body = stepBody(line);
  if (body === null) return null;
  for (const t of body.split(/\s+/)) {
    const { seconds, hasDistance } = parseDuration(t);
    if (seconds !== null) return { durationSeconds: seconds };
    if (hasDistance) return { durationSeconds: null };
  }
  return { durationSeconds: 0 };
}

export function parseDescriptionSummary(
  description: string
): Omit<WorkoutSummary, "id" | "name" | "folder_id"> {
  const lines = stripMarkers(description).split(/\r?\n/);
  let totalSeconds = 0;
  let stepCount = 0;
  let hasDistance = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const repeat = line.match(REPEAT_RE);
    if (repeat && stepBody(line) === null) {
      const iterations = Number(repeat[1]);
      const blockSteps: ParsedStep[] = [];
      let j = i + 1;
      while (j < lines.length) {
        if (lines[j].trim() === "") break;
        const parsed = parseStepLine(lines[j]);
        if (parsed) blockSteps.push(parsed);
        j++;
      }
      stepCount += iterations * blockSteps.length;
      for (const s of blockSteps) {
        if (s.durationSeconds === null) hasDistance = true;
        else totalSeconds += iterations * s.durationSeconds;
      }
      i = j;
      continue;
    }
    const parsed = parseStepLine(line);
    if (parsed) {
      stepCount++;
      if (parsed.durationSeconds === null) hasDistance = true;
      else totalSeconds += parsed.durationSeconds;
    }
    i++;
  }

  return {
    totalSeconds,
    stepCount,
    hasTemplate: hasTemplateMarker(description),
    oneLine: formatOneLine(stepCount, totalSeconds, hasDistance),
  };
}

function formatOneLine(
  steps: number,
  seconds: number,
  hasDistance: boolean
): string {
  if (steps === 0) return "Empty workout";
  const parts: string[] = [`${steps} step${steps === 1 ? "" : "s"}`];
  if (seconds > 0) parts.push(formatDuration(seconds));
  if (hasDistance) parts.push("includes distance steps");
  return parts.join(", ");
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m${s}s` : `${m}m`;
  return `${s}s`;
}
