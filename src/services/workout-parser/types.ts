import type { PlannedDocStep, PlannedPower, WorkoutDoc } from "../../types.js";

/**
 * The anchors a prescribed target is resolved against.
 *
 * Intervals.icu resolves both `%` and `Z` targets in workout text against the
 * athlete's **FTP**, not against the MAP zones the coaching layer reasons in —
 * see `docs/adr/0007-local-workout-text-parsing.md`. Resolving them any other
 * way would produce a number the athlete's dashboard never shows.
 */
export interface ParseAnchors {
  /** FTP in watts. Percentage and zone targets are unresolvable without it. */
  ftp?: number | null;
  /**
   * Upper bounds of the athlete's power zones as percentages of FTP — the
   * `power_zones` array on the cycling sport settings, e.g.
   * `[55, 75, 90, 105, 120, 150, 999]`. Zone targets are unresolvable without it.
   */
  powerZones?: number[] | null;
}

/** A line the parse read as a step and then dropped, with the reason. */
export interface DiscardedLine {
  /** 1-based line number in the source text. */
  line: number;
  text: string;
  reason: string;
}

/**
 * What a locally parsed document was produced from. Carried so a figure derived
 * from a local parse is never mistaken for one Intervals.icu computed.
 */
export interface ParseBasis {
  source: "local-parse";
  ftp?: number | null;
  powerZones?: number[] | null;
}

export interface ParsedWorkout {
  /**
   * The same shape Intervals.icu returns on an event, so every planned-side
   * lens consumes it by the path it already uses. Percentage and zone targets
   * are kept as the platform keeps them — as percentages and zone numbers —
   * and resolved to watts only at the point of use.
   */
  doc: WorkoutDoc;
  basis: ParseBasis;
  /** Step lines the platform would drop, named rather than silently vanished. */
  discarded: DiscardedLine[];
  /** Lines that carried no step — the workout's prose notes. */
  notes: string[];
}

/** A power target resolved to absolute watts. */
export interface ResolvedPower {
  /** Point target. */
  watts?: number;
  /** Band target, both ends inclusive. `low` is always the lesser. */
  low?: number;
  high?: number;
  /** True when `low`/`high` are the ends of a progression, not a band. */
  ramp?: boolean;
  /**
   * Set on a ramp that runs downward, so the sweep's direction survives the
   * min/max normalisation `low`/`high` impose. A cool-down written
   * `60-47%` ramps from `high` to `low`, not the other way about.
   */
  rampDescending?: boolean;
}

export interface IWorkoutParser {
  /** Parse workout text into Intervals.icu's own parsed-document shape. */
  parse(text: string, anchors?: ParseAnchors): ParsedWorkout;
  /**
   * Resolve one step's power target to absolute watts against the anchors,
   * naming a target it cannot resolve rather than substituting a default.
   */
  resolvePower(
    power: PlannedPower | undefined,
    anchors: ParseAnchors,
    ramp?: boolean
  ): { target?: ResolvedPower; unresolved?: string };
}

export type { PlannedDocStep, PlannedPower, WorkoutDoc };
