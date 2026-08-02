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
import type {
  ComparePlannedVsActualOptions,
  ISessionReview,
  PlannedVsActualResult,
  ReviewReason,
  SessionRollup,
} from "./types.js";

/**
 * Days either side of a planned event to scan when resolving it to the activity
 * that was ridden. There is no endpoint that filters activities by
 * `paired_event_id`, and an activity paired to an event is dated at or adjacent
 * to it, so a narrow window is enough.
 */
export const PAIR_SEARCH_WINDOW_DAYS = 2;

export interface SessionReviewDeps {
  activitiesApi: IActivitiesApi;
  eventsApi: IEventsApi;
}

export class SessionReview implements ISessionReview {
  constructor(private deps: SessionReviewDeps) {}

  async comparePlannedVsActual(
    options: ComparePlannedVsActualOptions
  ): Promise<PlannedVsActualResult> {
    const { activityId, eventId } = options;
    if (!!activityId === !!eventId) {
      throw new Error(
        "Supply exactly one of activityId or eventId — the other half of the " +
          "pair is resolved from the activity's paired event."
      );
    }

    const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

    const pair = activityId
      ? await this.fromActivity(activityId)
      : await this.fromEvent(eventId!);

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

  /** Activity given: read its recorded pairing and fetch that event. */
  private async fromActivity(activityId: string) {
    const activity = await this.deps.activitiesApi.getActivity(
      activityId,
      true
    );
    const pairedId = activity.paired_event_id;

    if (!pairedId) {
      return {
        activity,
        reason: "no-paired-event" as ReviewReason,
        message:
          `Activity ${activity.id} is not paired to a planned workout, so there ` +
          "is no prescription to compare it against.",
      };
    }

    const event = await this.deps.eventsApi.getEvent(pairedId);
    return { activity, event };
  }

  /** Event given: scan a narrow date window for the activity that points back. */
  private async fromEvent(eventId: number) {
    const event = await this.deps.eventsApi.getEvent(eventId);
    const day = (event.start_date_local ?? "").slice(0, 10);

    const activities = day
      ? await this.deps.activitiesApi.getActivities(
          shiftDate(day, -PAIR_SEARCH_WINDOW_DAYS),
          shiftDate(day, PAIR_SEARCH_WINDOW_DAYS)
        )
      : [];

    const activity = activities.find((a) => a.paired_event_id === eventId);

    if (!activity) {
      return {
        event,
        reason: "no-paired-activity" as ReviewReason,
        message:
          `No completed activity is paired to event ${eventId} within ` +
          `${PAIR_SEARCH_WINDOW_DAYS} days of ${day || "its date"} — the session ` +
          "was not executed, or has not been uploaded yet.",
      };
    }

    // The list payload omits icu_intervals; fetch the full activity.
    const full = await this.deps.activitiesApi.getActivity(activity.id, true);
    return { activity: full, event };
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

/** Shift a YYYY-MM-DD date by whole days, staying in UTC to avoid DST drift. */
function shiftDate(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function createSessionReview(deps: SessionReviewDeps): SessionReview {
  return new SessionReview(deps);
}
