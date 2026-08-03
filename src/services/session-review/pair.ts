import type { IActivitiesApi } from "../activities/index.js";
import type { IEventsApi } from "../events/index.js";
import type { ResolvedPair, ReviewReason } from "./types.js";

/**
 * Days either side of a planned event to scan when resolving it to the activity
 * that was ridden. There is no endpoint that filters activities by
 * `paired_event_id`, and an activity paired to an event is dated at or adjacent
 * to it, so a narrow window is enough.
 */
export const PAIR_SEARCH_WINDOW_DAYS = 2;

export interface PairDeps {
  activitiesApi: IActivitiesApi;
  eventsApi: IEventsApi;
}

/**
 * Resolve the two halves of a session from whichever one the caller has.
 *
 * Shared by both review lenses: the step lens and the band lens must agree on
 * what "this session" means, so pairing lives here rather than being
 * reimplemented per lens.
 */
export async function resolvePair(
  deps: PairDeps,
  options: { activityId?: string; eventId?: number }
): Promise<ResolvedPair> {
  const { activityId, eventId } = options;
  if (!!activityId === !!eventId) {
    throw new Error(
      "Supply exactly one of activityId or eventId — the other half of the " +
        "pair is resolved from the activity's paired event."
    );
  }

  return activityId
    ? fromActivity(deps, activityId)
    : fromEvent(deps, eventId!);
}

/** Activity given: read its recorded pairing and fetch that event. */
async function fromActivity(
  deps: PairDeps,
  activityId: string
): Promise<ResolvedPair> {
  const activity = await deps.activitiesApi.getActivity(activityId, true);
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

  const event = await deps.eventsApi.getEvent(pairedId);
  return { activity, event };
}

/** Event given: scan a narrow date window for the activity that points back. */
async function fromEvent(
  deps: PairDeps,
  eventId: number
): Promise<ResolvedPair> {
  const event = await deps.eventsApi.getEvent(eventId);
  const day = (event.start_date_local ?? "").slice(0, 10);

  const activities = day
    ? await deps.activitiesApi.getActivities(
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
  const full = await deps.activitiesApi.getActivity(activity.id, true);
  return { activity: full, event };
}

/** Shift a YYYY-MM-DD date by whole days, staying in UTC to avoid DST drift. */
export function shiftDate(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
