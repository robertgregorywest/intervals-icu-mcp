import type { IActivitiesApi } from "../activities/index.js";
import type { IEventsApi } from "../events/index.js";
import type { Activity } from "../activities/types.js";
import type { IntervalsEvent } from "../../types.js";
import { flattenPlannedSteps, plannedDuration } from "./planned.js";
import {
  DEFAULT_TOLERANCE,
  reviewSession,
  toDeliveredIntervals,
} from "./review.js";
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

    const intervals = toDeliveredIntervals(activity.icu_intervals ?? []);
    if (intervals.length === 0) {
      return this.refuse(
        activity,
        event,
        tolerance,
        "no-intervals",
        `Activity ${activity.id} has no recorded intervals, so per-step ` +
          "delivery cannot be read. Whole-activity averages are not a substitute.",
        planned.length ? plannedDuration(planned) : undefined
      );
    }

    const core = reviewSession({
      planned,
      intervals,
      tolerance,
      plannedLoad: event.icu_training_load,
      actualLoad: numberOrUndefined(activity.icu_training_load),
      plannedDurationSeconds: plannedDuration(planned),
      actualDurationSeconds: numberOrUndefined(activity.moving_time),
      platformCompliance: numberOrUndefined(activity.compliance),
    });

    return {
      activityId: activity.id,
      eventId: event.id,
      activityName: activity.name,
      eventName: event.name,
      date: activity.start_date_local,
      tolerance,
      ...core,
    };
  }

  /**
   * Every dead end returns the same shape: an empty step list, a named reason,
   * and the roll-up, which still answers the coarse question.
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
      alignmentBasis: "none",
      matchedFraction: 0,
      steps: [],
      rollup,
      reason,
      message,
    };
  }
}

function numberOrUndefined(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function createSessionReview(deps: SessionReviewDeps): SessionReview {
  return new SessionReview(deps);
}
