import type { IActivitiesApi } from "../activities/index.js";
import type { IEventsApi } from "../events/index.js";
import type { Activity } from "../activities/types.js";
import type { IntervalsEvent } from "../../types.js";
import { flattenPlannedSteps } from "../session-review/index.js";
import { resolvePair, shiftDate } from "../session-review/pair.js";
import {
  bucketDelivered,
  bucketPlanned,
  rollUpMiddleBand,
  type MiddleBandBounds,
} from "./bucket.js";
import {
  MIDDLE_BAND_HIGH_PCT_FTP,
  MIDDLE_BAND_LOW_PCT_FTP,
  derivePartition,
  middleBandBounds,
} from "./zones.js";
import type {
  CompareIntensityDistributionOptions,
  CompareIntensityDistributionRangeOptions,
  DistributionReason,
  ExcludedSession,
  IIntensityDistribution,
  IntensityDistributionRangeResult,
  IntensityDistributionResult,
  PartitionBand,
  RangeSessionRow,
  ZoneComparisonRow,
  ZoneRow,
} from "./types.js";

/**
 * Longest range the aggregate will span. Matches the 3–4 week block cadence the
 * coaching philosophy works in: a longer window stops describing one block, and
 * costs one activity fetch plus one stream fetch per paired session.
 */
export const MAX_RANGE_DAYS = 28;

export interface CoachingZones {
  zones: ZoneRow[] | null;
  ftp: number | null;
}

export interface IntensityDistributionDeps {
  activitiesApi: IActivitiesApi;
  eventsApi: IEventsApi;
  /**
   * The athlete's coaching frame. Injected rather than composed so the service
   * can be tested against a pinned frame — the athlete's MAP moves, and a test
   * whose expected seconds move with it is testing nothing.
   */
  getCoachingZones(): Promise<CoachingZones>;
}

export class IntensityDistribution implements IIntensityDistribution {
  constructor(private deps: IntensityDistributionDeps) {}

  async compareIntensityDistribution(
    options: CompareIntensityDistributionOptions
  ): Promise<IntensityDistributionResult> {
    // Throws on both-or-neither, before any HTTP.
    const pair = await resolvePair(this.deps, options);

    if (pair.reason) {
      return refuse(
        pair.activity,
        pair.event,
        pair.reason as DistributionReason,
        pair.message!
      );
    }

    const frame = await this.frame();
    return this.compare(pair.activity!, pair.event!, frame);
  }

  async compareIntensityDistributionRange(
    options: CompareIntensityDistributionRangeOptions
  ): Promise<IntensityDistributionRangeResult> {
    const { oldest, newest } = options;
    const days = daysBetween(oldest, newest);
    if (days > MAX_RANGE_DAYS) {
      throw new Error(
        `Range ${oldest}..${newest} spans ${days} days, over the ${MAX_RANGE_DAYS}-day ` +
          "maximum. Narrow the range — a longer window stops describing one block."
      );
    }

    const frame = await this.frame();
    const activities = await this.deps.activitiesApi.getActivities(
      oldest,
      newest
    );

    const plannedByZone = new Map<ZoneRow["name"], number>();
    const deliveredByZone = new Map<ZoneRow["name"], number>();
    let middlePlanned = 0;
    let middleDelivered = 0;
    const sessions: RangeSessionRow[] = [];
    const excluded: ExcludedSession[] = [];

    for (const listed of activities) {
      const eventId = listed.paired_event_id;
      if (!eventId) {
        // Unpaired work neither inflates nor deflates the aggregate — there is
        // no prescription for it to have been delivered against.
        excluded.push({
          date: listed.start_date_local,
          activityId: listed.id,
          name: listed.name,
          reason: "no-paired-event",
          message: `Activity ${listed.id} is not paired to a planned workout.`,
        });
        continue;
      }

      const activity = await this.deps.activitiesApi.getActivity(
        listed.id,
        true
      );
      const event = await this.deps.eventsApi.getEvent(eventId);
      const result = await this.compare(activity, event, frame);

      if (result.reason || !result.middleBand) {
        excluded.push({
          date: result.date,
          activityId: result.activityId,
          eventId: result.eventId,
          name: result.activityName ?? result.eventName,
          reason: result.reason ?? "no-coaching-zones",
          message: result.message ?? "No comparison could be computed.",
        });
        continue;
      }

      for (const row of result.zones ?? []) {
        plannedByZone.set(
          row.zone,
          (plannedByZone.get(row.zone) ?? 0) + row.plannedSeconds
        );
        deliveredByZone.set(
          row.zone,
          (deliveredByZone.get(row.zone) ?? 0) + row.deliveredSeconds
        );
      }
      middlePlanned += result.middleBand.plannedSeconds;
      middleDelivered += result.middleBand.deliveredSeconds;

      sessions.push({
        date: result.date,
        activityId: result.activityId,
        eventId: result.eventId,
        name: result.activityName ?? result.eventName,
        middleBandPlannedSeconds: result.middleBand.plannedSeconds,
        middleBandDeliveredSeconds: result.middleBand.deliveredSeconds,
        middleBandDeliveredFraction: result.middleBand.deliveredFraction,
      });
    }

    // Planned events in the range that no activity was paired to: the session
    // was prescribed and not delivered, which the sums must not absorb.
    const events = await this.deps.eventsApi.getEvents(oldest, newest);
    const pairedIds = new Set(
      activities.map((a) => a.paired_event_id).filter(Boolean)
    );
    for (const event of events) {
      if (event.category !== "WORKOUT") continue;
      if (event.id && pairedIds.has(event.id)) continue;
      excluded.push({
        date: event.start_date_local,
        eventId: event.id,
        name: event.name,
        reason: "no-paired-activity",
        message: `Planned event ${event.id} has no completed activity paired to it.`,
      });
    }

    return {
      oldest,
      newest,
      boundaries: frame.partition,
      zones: frame.partition.length
        ? toRows(frame.partition, plannedByZone, deliveredByZone)
        : undefined,
      middleBand: frame.middle
        ? rollUpMiddleBand(
            frame.middle,
            MIDDLE_BAND_LOW_PCT_FTP,
            MIDDLE_BAND_HIGH_PCT_FTP,
            middlePlanned,
            middleDelivered
          )
        : undefined,
      sessions,
      excluded,
    };
  }

  /** The bucketing frame, resolved once per call rather than per session. */
  private async frame(): Promise<Frame> {
    const { zones, ftp } = await this.deps.getCoachingZones();
    return {
      partition: zones ? derivePartition(zones) : [],
      middle: ftp && ftp > 0 ? middleBandBounds(ftp) : undefined,
    };
  }

  private async compare(
    activity: Activity,
    event: IntervalsEvent,
    frame: Frame
  ): Promise<IntensityDistributionResult> {
    const planned = flattenPlannedSteps(event.workout_doc, {
      ftp: event.icu_ftp ?? (activity.icu_ftp as number | undefined),
    });

    if (planned.length === 0) {
      return refuse(
        activity,
        event,
        "no-structured-steps",
        `Planned event ${event.id} carries no structured workout steps, so there ` +
          "is no prescribed distribution to compare the ride against."
      );
    }

    const streams = (await this.deps.activitiesApi.getActivityStreams(
      activity.id,
      ["watts"]
    )) as { watts?: (number | null)[] };
    const watts = streams.watts;

    if (!watts?.length) {
      return refuse(
        activity,
        event,
        "no-recorded-power",
        `Activity ${activity.id} has no recorded power, so what was delivered ` +
          "cannot be bucketed. Duration alone is not a substitute for intensity."
      );
    }

    const plannedBuckets = bucketPlanned(
      planned,
      frame.partition,
      frame.middle
    );
    const deliveredBuckets = bucketDelivered(
      watts,
      frame.partition,
      frame.middle
    );

    const base = {
      activityId: activity.id,
      eventId: event.id,
      activityName: activity.name,
      eventName: event.name,
      date: activity.start_date_local,
      plannedTotalSeconds: plannedBuckets.totalSeconds,
      deliveredTotalSeconds: deliveredBuckets.totalSeconds,
      unbucketedSteps: plannedBuckets.unbucketed,
      boundarySpanningSteps: plannedBuckets.boundarySpanning,
    };

    // The middle band survives a missing zone frame: its bounds come from FTP,
    // not from the zones, so losing one does not cost the other.
    const middleBand = frame.middle
      ? rollUpMiddleBand(
          frame.middle,
          MIDDLE_BAND_LOW_PCT_FTP,
          MIDDLE_BAND_HIGH_PCT_FTP,
          plannedBuckets.middleBandSeconds,
          deliveredBuckets.middleBandSeconds
        )
      : undefined;

    if (frame.partition.length === 0) {
      return {
        ...base,
        middleBand,
        reason: "no-coaching-zones",
        message:
          "The athlete's coaching zones could not be resolved, so there is no " +
          "frame to bucket into. The middle band is reported regardless, its " +
          "bounds being a percentage of FTP rather than of the zone model.",
      };
    }

    return {
      ...base,
      boundaries: frame.partition,
      zones: toRows(
        frame.partition,
        plannedBuckets.byZone,
        deliveredBuckets.byZone
      ),
      middleBand,
    };
  }
}

interface Frame {
  partition: PartitionBand[];
  middle?: MiddleBandBounds;
}

function toRows(
  partition: PartitionBand[],
  planned: Map<ZoneRow["name"], number>,
  delivered: Map<ZoneRow["name"], number>
): ZoneComparisonRow[] {
  return partition.map((band) => {
    const plannedSeconds = planned.get(band.name) ?? 0;
    const deliveredSeconds = delivered.get(band.name) ?? 0;
    return {
      zone: band.name,
      lowW: band.lowW,
      highW: band.highW,
      plannedSeconds,
      deliveredSeconds,
      deltaSeconds: deliveredSeconds - plannedSeconds,
    };
  });
}

/**
 * Every dead end returns the same shape with a named reason — never a
 * distribution of zeroes, which would read as "nothing was ridden at any
 * intensity" rather than "this could not be computed".
 */
function refuse(
  activity: Activity | undefined,
  event: IntervalsEvent | undefined,
  reason: DistributionReason,
  message: string
): IntensityDistributionResult {
  return {
    activityId: activity?.id,
    eventId: event?.id,
    activityName: activity?.name,
    eventName: event?.name,
    date: activity?.start_date_local ?? event?.start_date_local,
    plannedTotalSeconds: 0,
    deliveredTotalSeconds: 0,
    unbucketedSteps: [],
    boundarySpanningSteps: [],
    reason,
    message,
  };
}

/** Whole days spanned by an inclusive YYYY-MM-DD range. */
function daysBetween(oldest: string, newest: string): number {
  const a = Date.parse(`${oldest}T00:00:00Z`);
  const b = Date.parse(`${newest}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new Error(
      `Range dates must be YYYY-MM-DD; got "${oldest}".."${newest}".`
    );
  }
  return Math.round((b - a) / 86_400_000) + 1;
}

export function createIntensityDistribution(
  deps: IntensityDistributionDeps
): IntensityDistribution {
  return new IntensityDistribution(deps);
}

export { shiftDate };
