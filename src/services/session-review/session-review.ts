import type { IActivitiesApi } from "../activities/index.js";
import type { IEventsApi } from "../events/index.js";
import type { Activity } from "../activities/types.js";
import type { IntervalsEvent } from "../../types.js";
import { flattenPlannedSteps, plannedDuration } from "./planned.js";
import { DEFAULT_TOLERANCE, reviewSession } from "./review.js";
import { executionCandidates, type ExecutionCandidate } from "./delivered.js";
import { resolvePair } from "./pair.js";
import type {
  ComparePlannedVsActualOptions,
  ISessionReview,
  PlannedVsActualResult,
  ReviewReason,
  SessionRollup,
} from "./types.js";

export { PAIR_SEARCH_WINDOW_DAYS } from "./pair.js";

export interface SessionReviewDeps {
  activitiesApi: IActivitiesApi;
  eventsApi: IEventsApi;
}

export class SessionReview implements ISessionReview {
  constructor(private deps: SessionReviewDeps) {}

  async comparePlannedVsActual(
    options: ComparePlannedVsActualOptions
  ): Promise<PlannedVsActualResult> {
    const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

    const pair = await resolvePair(this.deps, options);

    if (pair.reason) {
      return this.refuse(
        pair.activity,
        pair.event,
        tolerance,
        pair.reason,
        pair.message!
      );
    }

    const activity = pair.activity!;
    const event = pair.event!;

    const planned = flattenPlannedSteps(event.workout_doc, {
      ftp: event.icu_ftp ?? (activity.icu_ftp as number | undefined),
    });

    if (planned.length === 0) {
      return this.refuse(
        activity,
        event,
        tolerance,
        "no-structured-steps",
        `Planned event ${event.id} carries no structured workout steps, so ` +
          "there is nothing to compare the ride against."
      );
    }

    const laps = await this.deps.activitiesApi.getActivityLaps(activity.id);
    const candidates = executionCandidates(activity, laps);

    if (candidates.length === 0) {
      return this.refuse(
        activity,
        event,
        tolerance,
        "no-intervals",
        `Activity ${activity.id} has neither recorded laps nor detected ` +
          "intervals, so per-step delivery cannot be read. Whole-activity " +
          "averages are not a substitute.",
        planned.length ? plannedDuration(planned) : undefined
      );
    }

    const rollupInputs = {
      plannedLoad: event.icu_training_load,
      actualLoad: numberOrUndefined(activity.icu_training_load),
      plannedDurationSeconds: plannedDuration(planned),
      actualDurationSeconds: numberOrUndefined(activity.moving_time),
      platformCompliance: numberOrUndefined(activity.compliance),
    };

    const chosen = pickCandidate(candidates, (candidate) =>
      reviewSession({
        planned,
        intervals: candidate.intervals,
        tolerance,
        ...rollupInputs,
      })
    );

    return {
      activityId: activity.id,
      eventId: event.id,
      activityName: activity.name,
      eventName: event.name,
      date: activity.start_date_local,
      tolerance,
      executionRecord: chosen.candidate.source,
      ...(chosen.candidate.note
        ? { executionRecordNote: chosen.candidate.note }
        : {}),
      ...chosen.core,
    };
  }

  /**
   * Every dead end returns the same shape: an empty step list, a named reason,
   * and the roll-up, which still answers the coarse question.
   *
   * `executionRecord` reports the source that would have been read, so a refusal
   * still says what it was looking at.
   */
  private refuse(
    activity: Activity | undefined,
    event: IntervalsEvent | undefined,
    tolerance: number,
    reason: ReviewReason,
    message: string,
    plannedDurationSeconds?: number
  ): PlannedVsActualResult {
    const rollup: SessionRollup = {
      plannedLoad: event?.icu_training_load,
      actualLoad: numberOrUndefined(activity?.icu_training_load),
      plannedDurationSeconds:
        plannedDurationSeconds ?? numberOrUndefined(event?.moving_time),
      actualDurationSeconds: numberOrUndefined(activity?.moving_time),
      platformCompliance: numberOrUndefined(activity?.compliance),
      unplannedIntervals: [],
    };

    return {
      activityId: activity?.id,
      eventId: event?.id,
      activityName: activity?.name,
      eventName: event?.name,
      date: activity?.start_date_local ?? event?.start_date_local,
      tolerance,
      executionRecord: "detected-intervals",
      alignmentBasis: "none",
      matchedFraction: 0,
      steps: [],
      rollup,
      reason,
      message,
    };
  }
}

type ReviewCore = ReturnType<typeof reviewSession>;

/**
 * Review each candidate reading in preference order and keep the first that
 * aligns at all.
 *
 * Deliberately not "whichever aligns best". Detection re-cuts step boundaries
 * to whatever the power trace suggests, so it can out-score the laps precisely
 * on the sessions where it has invented the structure — the failure this
 * comparison exists to catch. The laps only lose when they explain nothing.
 * When no candidate aligns, the preferred one's refusal is the one reported.
 */
function pickCandidate(
  candidates: ExecutionCandidate[],
  review: (candidate: ExecutionCandidate) => ReviewCore
): { candidate: ExecutionCandidate; core: ReviewCore } {
  let first: { candidate: ExecutionCandidate; core: ReviewCore } | undefined;

  for (const candidate of candidates) {
    const core = review(candidate);
    if (!first) first = { candidate, core };
    if (core.alignmentBasis !== "none") return { candidate, core };
  }

  return first!;
}

function numberOrUndefined(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function createSessionReview(deps: SessionReviewDeps): SessionReview {
  return new SessionReview(deps);
}
