import type { Rationale, RationaleIntensity, WorkoutSummary } from "./types.js";

const RATIONALE_RE = /<!--\s*rationale\s*([\s\S]+?)\s*-->/i;
const DURATION_RE = /(\d+)(km|mtr|h|m|s)(?![a-z])/gi;
const REPEAT_RE = /(?:^|\s)(\d+)x\s*$/;

export function extractRationale(description: string): Rationale | null {
  if (!description) return null;
  const match = description.match(RATIONALE_RE);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as Rationale;
    if (parsed && (parsed.basis === "MAP" || parsed.basis === "FTP")) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function stripRationale(description: string): string {
  return description.replace(RATIONALE_RE, "").trimEnd();
}

export function embedRationale(
  description: string,
  rationale: Rationale
): string {
  const stripped = stripRationale(description);
  const json = JSON.stringify(rationale);
  return `${stripped}\n\n<!-- rationale ${json} -->`;
}

const WATTS_TARGET_RE = /\d+w(?:-\d+w)?/;
const STEP_LINE_RE = /^\s*-\s/;

function formatWatts(
  pct: RationaleIntensity["pct"],
  anchorWatts: number
): string {
  if (Array.isArray(pct)) {
    const lo = Math.round((pct[0] / 100) * anchorWatts);
    const hi = Math.round((pct[1] / 100) * anchorWatts);
    return `${lo}w-${hi}w`;
  }
  return `${Math.round((pct / 100) * anchorWatts)}w`;
}

export interface RegenerateResult {
  description: string;
  stepCount: number;
  intensityCount: number;
  matched: number;
}

/**
 * Re-emits the watt target on each step line using the rationale's `intensities`
 * (matched in source order), then re-embeds the rationale with the new
 * `anchorWatts`. Anything that isn't a watts pattern (cadence, durations,
 * labels, prose) is left alone.
 *
 * If step-line count and intensity count don't agree, we apply what we can and
 * report the counts so the caller can warn.
 */
export function regenerateWattsInDescription(
  description: string,
  rationale: Rationale,
  newAnchorWatts: number
): RegenerateResult {
  const intensities = rationale.intensities ?? [];
  const stripped = stripRationale(description);
  const lines = stripped.split(/\r?\n/);

  let stepCount = 0;
  let matched = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!STEP_LINE_RE.test(lines[i])) continue;
    const intensity = intensities[stepCount];
    stepCount++;
    if (!intensity) continue; // more step lines than intensities — skip silently here, caller compares counts
    const newTarget = formatWatts(intensity.pct, newAnchorWatts);
    if (WATTS_TARGET_RE.test(lines[i])) {
      lines[i] = lines[i].replace(WATTS_TARGET_RE, newTarget);
      matched++;
    }
  }

  const newDescription = embedRationale(lines.join("\n"), {
    ...rationale,
    anchorWatts: newAnchorWatts,
  });

  return {
    description: newDescription,
    stepCount,
    intensityCount: intensities.length,
    matched,
  };
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
  const trimmed = line.trim();
  if (!trimmed.startsWith("- ")) return null;
  const body = trimmed.slice(2).trim();
  // first token after optional label is the duration
  // but our format puts duration after label: "- [label] 5m 95% 90rpm"
  // try matching every token until we find a duration
  const tokens = body.split(/\s+/);
  for (const t of tokens) {
    const { seconds, hasDistance } = parseDuration(t);
    if (seconds !== null) {
      return { durationSeconds: seconds };
    }
    if (hasDistance) {
      return { durationSeconds: null };
    }
  }
  return { durationSeconds: 0 };
}

export function parseDescriptionSummary(
  description: string
): Omit<WorkoutSummary, "id" | "name" | "folder_id"> {
  const stripped = stripRationale(description);
  const lines = stripped.split(/\r?\n/);
  let totalSeconds = 0;
  let stepCount = 0;
  let hasDistance = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const repeat = line.match(REPEAT_RE);
    if (repeat) {
      const iterations = Number(repeat[1]);
      const blockSteps: ParsedStep[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j].trim();
        if (next === "") break;
        const parsed = parseStepLine(lines[j]);
        if (parsed) blockSteps.push(parsed);
        j++;
      }
      stepCount += iterations * blockSteps.length;
      for (const s of blockSteps) {
        if (s.durationSeconds === null) {
          hasDistance = true;
        } else {
          totalSeconds += iterations * s.durationSeconds;
        }
      }
      i = j;
      continue;
    }
    const parsed = parseStepLine(line);
    if (parsed) {
      stepCount++;
      if (parsed.durationSeconds === null) {
        hasDistance = true;
      } else {
        totalSeconds += parsed.durationSeconds;
      }
    }
    i++;
  }

  const oneLine = formatOneLine(stepCount, totalSeconds, hasDistance);
  return {
    totalSeconds,
    stepCount,
    hasRationale: extractRationale(description) !== null,
    oneLine,
  };
}

function formatOneLine(
  steps: number,
  seconds: number,
  hasDistance: boolean
): string {
  if (steps === 0) return "Empty workout";
  const parts: string[] = [`${steps} step${steps === 1 ? "" : "s"}`];
  if (seconds > 0) {
    parts.push(formatDuration(seconds));
  }
  if (hasDistance) {
    parts.push("includes distance steps");
  }
  return parts.join(", ");
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }
  if (m > 0) {
    return s > 0 ? `${m}m${s}s` : `${m}m`;
  }
  return `${s}s`;
}
