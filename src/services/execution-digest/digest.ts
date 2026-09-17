import type { IEventsApi } from "../events/index.js";
import type { IntervalsEvent } from "../../types.js";
import type { ISessionReview } from "../session-review/types.js";
import type {
  AlignedStep,
  FlatPlannedStep,
  PlannedVsActualResult,
  PowerTarget,
} from "../session-review/types.js";
import { flattenPlannedSteps } from "../session-review/index.js";
import type {
  IIntensityDistribution,
  IntensityDistributionRangeResult,
  RangeSessionRow,
} from "../intensity-distribution/types.js";
import { MAX_RANGE_DAYS } from "../intensity-distribution/index.js";
import { isWorkLabel } from "../step-roles/index.js";
import type {
  CadenceRollup,
  DigestSession,
  ExecutionDigestResult,
  FlaggedStep,
  GetExecutionDigestOptions,
  IExecutionDigest,
} from "./types.js";

/**
 * A session counts as key when it prescribes a work step at or above this.
 *
 * Anchored on FTP rather than on the MAP zones, to sit in the same frame as the
 * middle band the dose is judged in — the sweet-spot floor is the bottom of the
 * work the philosophy treats as a build week's substance.
 */
export const KEY_SESSION_FLOOR_PCT_FTP = 88;

/**
 * Power miss on a range target smaller than this is noise, not a finding: the
 * verdict on a band step is directional with no tolerance, so a delivery a few
 * watts outside its own band returns `over`/`under` with nothing behind it.
 * Point targets carry the comparison's own tolerance and are not re-filtered.
 */
export const RANGE_TARGET_NOISE_FRACTION = 0.03;

/** Below this, a coasting fraction says nothing about a normalized-power read. */
const COASTING_WORTH_REPORTING = 0.05;

export interface ExecutionDigestDeps {
  eventsApi: IEventsApi;
  sessionReview: ISessionReview;
  intensityDistribution: IIntensityDistribution;
  /** The athlete's FTP, for events that carry none of their own. */
  getFtp(): Promise<number | null>;
}

/**
 * The execution review's deterministic half, computed in one call.
 *
 * Selecting key sessions, running both lenses and dropping what the lenses call
 * an artefact is mechanical, and used to be re-derived by a forked model on
 * every review. What is left — recurrence, whether a test's overshoot is the
 * test working, what to change — is judgement, and stays with the coaching
 * thread that has the athlete's context loaded. See
 * `docs/adr/0010-work-steps-declared-in-the-label.md`.
 */
export class ExecutionDigest implements IExecutionDigest {
  constructor(private deps: ExecutionDigestDeps) {}

  async getExecutionDigest(
    options: GetExecutionDigestOptions
  ): Promise<ExecutionDigestResult> {
    const { oldest, newest } = options;
    const days = daysBetween(oldest, newest);
    if (days < 0) {
      throw new Error(
        `Window ${oldest}..${newest} ends before it starts. ` +
          "Supply oldest then newest."
      );
    }
    if (days > MAX_RANGE_DAYS) {
      throw new Error(
        `Window ${oldest}..${newest} spans ${days} days, over the ` +
          `${MAX_RANGE_DAYS}-day maximum. Narrow it — a longer window stops ` +
          "describing one block."
      );
    }

    const events = await this.deps.eventsApi.getEvents(oldest, newest);
    const athleteFtp = await this.deps.getFtp();

    // Selection runs on the planned side, so a key session that was abandoned
    // or never started is selected and reported rather than silently missed.
    const planned = events
      .filter((e) => e.category === "WORKOUT")
      .map((event) => plannedSummary(event, athleteFtp));
    const key = planned.filter((p) => p.isKey);

    if (key.length === 0) {
      return {
        oldest,
        newest,
        status: "skipped",
        message:
          `No key session in ${oldest}..${newest}: no planned work step at or ` +
          `above ${KEY_SESSION_FLOOR_PCT_FTP}% FTP. The watermark stays where ` +
          "it is.",
        sessions: [],
        excluded: [],
        nonKeySessions: planned.length,
      };
    }

    const [distribution, reviews] = await Promise.all([
      this.deps.intensityDistribution.compareIntensityDistributionRange({
        oldest,
        newest,
      }),
      Promise.all(
        key.map((p) =>
          this.deps.sessionReview.comparePlannedVsActual({
            eventId: p.event.id!,
          })
        )
      ),
    ]);

    const doseByEvent = new Map<number, RangeSessionRow>();
    for (const row of distribution.sessions) {
      if (row.eventId !== undefined) doseByEvent.set(row.eventId, row);
    }

    const sessions = reviews.map((review, i) =>
      digestSession(review, key[i]!.steps, doseByEvent)
    );

    return {
      oldest,
      newest,
      status: "reviewed",
      reviewedThrough: newest,
      ...windowDose(distribution),
      sessions,
      excluded: distribution.excluded.map(({ message: _message, ...rest }) => ({
        ...rest,
      })),
      nonKeySessions: planned.length - key.length,
    };
  }
}

interface PlannedSummary {
  event: IntervalsEvent;
  steps: FlatPlannedStep[];
  isKey: boolean;
}

/**
 * Flatten one planned event and decide whether it is a key session: a work step
 * — declared as such by its label — prescribed at or above the sweet-spot floor.
 *
 * Intensity alone would select on any step, which is how a warm-up ramp topping
 * out at threshold used to pull an endurance ride into the review.
 */
function plannedSummary(
  event: IntervalsEvent,
  athleteFtp: number | null
): PlannedSummary {
  const ftp = event.icu_ftp ?? athleteFtp;
  const steps = flattenPlannedSteps(event.workout_doc, { ftp });
  const floor = ftp ? (ftp * KEY_SESSION_FLOOR_PCT_FTP) / 100 : undefined;

  const isKey =
    event.id !== undefined &&
    floor !== undefined &&
    steps.some(
      (s) =>
        isWorkLabel(s.label) &&
        targetMidpoint(s.target) !== undefined &&
        targetMidpoint(s.target)! >= floor
    );

  return { event, steps, isKey };
}

/**
 * Reduce one comparison to the work steps that missed their prescription.
 *
 * Every drop here is one the lenses call an artefact: a step whose label
 * declares no work role (a warm-up, a recovery step, a cool-down), a step that
 * met both its power and its cadence, and a band step outside its band by less
 * than noise. What survives is a rep that did not do what it was asked to.
 */
function digestSession(
  review: PlannedVsActualResult,
  planned: FlatPlannedStep[],
  doseByEvent: Map<number, RangeSessionRow>
): DigestSession {
  const workIndexes = new Set(
    planned.filter((s) => isWorkLabel(s.label)).map((s) => s.index)
  );
  const work = review.steps.filter((s) => workIndexes.has(s.index));
  const dose =
    review.eventId !== undefined ? doseByEvent.get(review.eventId) : undefined;

  return {
    eventId: review.eventId,
    activityId: review.activityId,
    date: review.date?.slice(0, 10),
    name: review.eventName,
    executionRecord: review.executionRecord,
    ...(review.executionRecordNote
      ? { executionRecordNote: review.executionRecordNote }
      : {}),
    alignmentBasis: review.alignmentBasis,
    workSteps: workIndexes.size,
    unclassifiedSteps: planned.length - workIndexes.size,
    flagged: work.filter(flagged).map(reduceStep),
    ...cadenceRollup(work),
    middleBandPlannedSeconds: dose?.middleBandPlannedSeconds,
    middleBandDeliveredSeconds: dose?.middleBandDeliveredSeconds,
    middleBandDeliveredFraction: dose?.middleBandDeliveredFraction,
    platformCompliance: review.rollup.platformCompliance,
    ...(review.reason
      ? { reason: review.reason, message: review.message }
      : {}),
  };
}

/** Whether a work step missed its prescription by more than noise. */
function flagged(step: AlignedStep): boolean {
  if (step.cadenceVerdict && step.cadenceVerdict !== "on-target") return true;
  if (step.verdict === "on-target") return false;
  if (step.verdict === "unmatched" || step.verdict === "not-attempted")
    return true;

  const isRange =
    step.planned.target?.low !== undefined && step.planned.target.ramp !== true;
  if (!isRange) return true;

  const fraction = Math.abs(step.deltas?.wattsFraction ?? 0);
  return fraction >= RANGE_TARGET_NOISE_FRACTION;
}

function reduceStep(step: AlignedStep): FlaggedStep {
  const coasting = step.delivered?.coastingFraction;
  return {
    index: step.index,
    ...(step.repIndex !== undefined
      ? { repIndex: step.repIndex, repCount: step.repCount }
      : {}),
    ...(step.stepInRep !== undefined ? { stepInRep: step.stepInRep } : {}),
    durationSeconds: step.planned.durationSeconds,
    target: step.planned.target,
    verdict: step.verdict,
    verdictBasis: step.verdictBasis,
    ...(step.deltas
      ? {
          deltas: {
            watts: step.deltas.watts,
            wattsFraction: step.deltas.wattsFraction,
            cadence: step.deltas.cadence,
          },
        }
      : {}),
    ...(step.cadenceVerdict ? { cadenceVerdict: step.cadenceVerdict } : {}),
    ...(coasting !== undefined && coasting >= COASTING_WORTH_REPORTING
      ? { coastingFraction: coasting }
      : {}),
  };
}

/**
 * Cadence across the session's work steps. A cadence missed on every rep is one
 * finding about the session, not a detail on each rep, so the count travels
 * beside the steps rather than only inside them.
 */
function cadenceRollup(work: AlignedStep[]): { cadence?: CadenceRollup } {
  const judged = work.filter((s) => s.cadenceVerdict !== undefined);
  if (judged.length === 0) return {};
  return {
    cadence: {
      judged: judged.length,
      missed: judged.filter((s) => s.cadenceVerdict !== "on-target").length,
    },
  };
}

function windowDose(
  distribution: IntensityDistributionRangeResult
): Pick<ExecutionDigestResult, "middleBand" | "zones" | "boundaries"> {
  return {
    ...(distribution.middleBand ? { middleBand: distribution.middleBand } : {}),
    ...(distribution.zones ? { zones: distribution.zones } : {}),
    ...(distribution.boundaries ? { boundaries: distribution.boundaries } : {}),
  };
}

/** A band's midpoint, a point target's watts; undefined when unresolved. */
function targetMidpoint(target: PowerTarget | undefined): number | undefined {
  if (!target) return undefined;
  if (typeof target.watts === "number") return target.watts;
  if (typeof target.low === "number" && typeof target.high === "number") {
    return (target.low + target.high) / 2;
  }
  return undefined;
}

function daysBetween(oldest: string, newest: string): number {
  const from = Date.parse(`${oldest}T00:00:00Z`);
  const to = Date.parse(`${newest}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function createExecutionDigest(
  deps: ExecutionDigestDeps
): ExecutionDigest {
  return new ExecutionDigest(deps);
}
