import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  createWorkoutParser,
  resolvePowerTarget,
  type ParseAnchors,
  type ParsedWorkout,
} from "../../../src/services/workout-parser/index.js";
import type { PlannedDocStep } from "../../../src/types.js";
import type {
  GradeOutcome,
  Grader,
  GraderSpec,
  RunArtifacts,
} from "../lib/types.js";

const parser = createWorkoutParser();

/** A workout the run wrote to the calendar, parsed as the platform would. */
interface WrittenWorkout {
  label: string;
  parsed: ParsedWorkout;
}

const EVENT_WRITE = /\/events(\/bulk|\/\d+)?$/;

/**
 * Every workout text the run wrote as a calendar event — POST, bulk POST or
 * PUT — optionally only those on `date:` (YYYY-MM-DD). Library writes
 * (`/workouts`) are not calendar workouts and are left out.
 */
function writtenWorkouts(
  spec: GraderSpec,
  run: RunArtifacts
): WrittenWorkout[] {
  const date = spec.date ? String(spec.date) : null;
  const anchors = anchorsFor(spec, run);
  const out: WrittenWorkout[] = [];
  for (const w of run.writes) {
    if (w.method === "DELETE" || !EVENT_WRITE.test(w.path)) continue;
    const items = Array.isArray(w.body) ? w.body : [w.body];
    for (const item of items as Array<Record<string, unknown> | null>) {
      if (typeof item?.description !== "string") continue;
      const start = String(item.start_date_local ?? "");
      if (date && start && !start.startsWith(date)) continue;
      out.push({
        label: `${w.method} ${String(item.name ?? "workout")}${start ? ` on ${start.slice(0, 10)}` : ""}`,
        parsed: parser.parse(item.description, anchors),
      });
    }
  }
  return out;
}

const anchorCache = new Map<string, ParseAnchors>();

/**
 * FTP and power zones to resolve `%` and `Z` targets against: the case's own
 * `ftp:`/`powerZones:` when given, else the athlete record in the cassette
 * (the `sport:` settings, Ride by default).
 */
function anchorsFor(spec: GraderSpec, run: RunArtifacts): ParseAnchors {
  if (typeof spec.ftp === "number") {
    return {
      ftp: spec.ftp,
      powerZones: Array.isArray(spec.powerZones)
        ? spec.powerZones.map(Number)
        : null,
    };
  }
  const sport = String(spec.sport ?? "Ride");
  const dir = join(run.evalCase.dir, "cassette");
  const cacheKey = `${dir}#${sport}`;
  const cached = anchorCache.get(cacheKey);
  if (cached) return cached;
  let anchors: ParseAnchors = {};
  for (const file of readdirSync(dir)) {
    const entry = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
      key: string;
      body: string;
    };
    if (!/^GET \S*\/athlete\/[^/?]+$/.test(entry.key)) continue;
    const athlete = JSON.parse(entry.body) as {
      sportSettings?: Array<{
        types: string[];
        ftp?: number | null;
        power_zones?: number[] | null;
      }>;
    };
    const s = athlete.sportSettings?.find((x) => x.types.includes(sport));
    if (s) anchors = { ftp: s.ftp ?? null, powerZones: s.power_zones ?? null };
    break;
  }
  anchorCache.set(cacheKey, anchors);
  return anchors;
}

/** Leaf steps with repeats expanded into a multiplier on their time. */
function leafSteps(
  steps: PlannedDocStep[] | undefined,
  reps = 1
): Array<{ step: PlannedDocStep; reps: number }> {
  return (steps ?? []).flatMap((s) =>
    Array.isArray(s.steps)
      ? leafSteps(s.steps, reps * (s.reps ?? 1))
      : [{ step: s, reps }]
  );
}

function minutes(seconds: number): string {
  const m = seconds / 60;
  return `${Number.isInteger(m) ? m : m.toFixed(1)}m`;
}

function noWorkout(spec: GraderSpec): GradeOutcome {
  return {
    passed: false,
    explanation: `no workout written${spec.date ? ` on ${String(spec.date)}` : ""}`,
  };
}

/**
 * Each written workout parses into at least one step with no line the
 * platform would drop.
 */
export const workoutParses: Grader = (spec, run) => {
  const workouts = writtenWorkouts(spec, run);
  if (workouts.length === 0) return noWorkout(spec);
  const problems = workouts.flatMap(({ label, parsed }) => [
    ...(parsed.doc.steps?.length ? [] : [`${label}: no steps`]),
    ...parsed.discarded.map(
      (d) => `${label}: line ${d.line} "${d.text}" dropped (${d.reason})`
    ),
  ]);
  return {
    passed: problems.length === 0,
    explanation: problems.length
      ? problems.join("; ")
      : `${workouts.length} workout(s) parse cleanly`,
  };
};

/**
 * The work steps — those whose target reaches `workAbove` W (default 90% of
 * the band's floor) — all sit inside `band: [lowW, highW]` (± `tolerance` W).
 * With `workMinutes: {min, max}`, their total time is also bounded, which is
 * what tells a trimmed 2×15 from a full 2×20 at the same watts.
 */
export const targetsInBand: Grader = (spec, run) => {
  const [lowW, highW] = (spec.band as [number, number] | undefined) ?? [];
  if (typeof lowW !== "number" || typeof highW !== "number") {
    throw new Error("targetsInBand needs band: [lowW, highW]");
  }
  const tolerance = Number(spec.tolerance ?? 0);
  const workAbove = Number(spec.workAbove ?? lowW * 0.9);
  const workMinutes = (spec.workMinutes ?? {}) as {
    min?: number;
    max?: number;
  };
  const anchors = anchorsFor(spec, run);
  const workouts = writtenWorkouts(spec, run);
  if (workouts.length === 0) return noWorkout(spec);

  const problems: string[] = [];
  const summaries: string[] = [];
  for (const { label, parsed } of workouts) {
    let workSeconds = 0;
    for (const { step, reps } of leafSteps(parsed.doc.steps)) {
      if (!step.power) continue;
      const stepName = step.text
        ? `"${step.text}"`
        : `${minutes(step.duration ?? 0)} step`;
      const { target, unresolved } = resolvePowerTarget(
        step.power,
        anchors,
        step.ramp
      );
      if (!target) {
        problems.push(`${label}: ${stepName} ${unresolved ?? "no target"}`);
        continue;
      }
      const lo = Math.round(target.low ?? target.watts ?? 0);
      const hi = Math.round(target.high ?? target.watts ?? 0);
      if ((lo + hi) / 2 < workAbove) continue;
      workSeconds += (step.duration ?? 0) * reps;
      if (lo < lowW - tolerance || hi > highW + tolerance) {
        problems.push(
          `${label}: ${stepName} at ${lo === hi ? lo : `${lo}–${hi}`} W, outside ${lowW}–${highW} W`
        );
      }
    }
    if (workSeconds === 0) {
      problems.push(`${label}: no step at or above ${Math.round(workAbove)} W`);
      continue;
    }
    const workMin = workSeconds / 60;
    if (workMinutes.min !== undefined && workMin < workMinutes.min) {
      problems.push(
        `${label}: ${minutes(workSeconds)} of work, under ${workMinutes.min}m`
      );
    }
    if (workMinutes.max !== undefined && workMin > workMinutes.max) {
      problems.push(
        `${label}: ${minutes(workSeconds)} of work, over ${workMinutes.max}m`
      );
    }
    summaries.push(`${label}: ${minutes(workSeconds)} of work`);
  }
  return {
    passed: problems.length === 0,
    explanation: problems.length
      ? problems.join("; ")
      : `work in ${lowW}–${highW} W — ${summaries.join("; ")}`,
  };
};

/** Each written workout's total time is within `minMinutes`–`maxMinutes`. */
export const durationWithin: Grader = (spec, run) => {
  const min = spec.minMinutes === undefined ? 0 : Number(spec.minMinutes);
  const max =
    spec.maxMinutes === undefined ? Infinity : Number(spec.maxMinutes);
  const workouts = writtenWorkouts(spec, run);
  if (workouts.length === 0) return noWorkout(spec);
  const problems: string[] = [];
  const totals: string[] = [];
  for (const { label, parsed } of workouts) {
    const seconds = parsed.doc.duration ?? 0;
    totals.push(`${label}: ${minutes(seconds)}`);
    if (seconds / 60 < min || seconds / 60 > max) {
      problems.push(
        `${label}: ${minutes(seconds)}, outside ${min}–${max === Infinity ? "∞" : max}m`
      );
    }
  }
  return {
    passed: problems.length === 0,
    explanation: problems.length ? problems.join("; ") : totals.join("; "),
  };
};
