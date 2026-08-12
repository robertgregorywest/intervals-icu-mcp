import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { IIntervalsClient } from "./index.js";
import {
  createWorkoutSchema,
  createWorkout,
  createStrengthWorkoutSchema,
  createStrengthWorkout,
  createWorkoutOutputSchema,
} from "./tools/workouts.js";
import { getAthleteSchema, getAthlete } from "./tools/athlete.js";
import {
  getActivitiesSchema,
  getActivities,
  getActivitiesOutputSchema,
  getActivitySchema,
  getActivity,
  getActivityStreamsSchema,
  getActivityStreams,
} from "./tools/activities.js";
import {
  getEventsSchema,
  getEvents,
  getEventsOutputSchema,
  getEventSchema,
  getEvent,
  updateEventSchema,
  updateEvent,
  deleteEventsSchema,
  deleteEvents,
  deleteEventsOutputSchema,
} from "./tools/events.js";
import {
  getWellnessSchema,
  getWellness,
  getWellnessOutputSchema,
  getFitnessSummarySchema,
  getFitnessSummary,
} from "./tools/wellness.js";
import { getPowerCurveSchema, getPowerCurve } from "./tools/power.js";
import {
  getAerobicDecouplingSchema,
  getAerobicDecoupling,
  getAerobicDecouplingOutputSchema,
  compareIntervalsSchema,
  compareIntervalsHandler,
  compareIntervalsOutputSchema,
} from "./tools/analysis.js";
import {
  comparePlannedVsActualSchema,
  comparePlannedVsActual,
  comparePlannedVsActualOutputSchema,
} from "./tools/session-review.js";
import {
  computeTrackLapPowerSchema,
  computeTrackLapPower,
  computeTrackLapPowerOutputSchema,
} from "./tools/track-lap-alignment.js";
import {
  compareIntensityDistributionSchema,
  compareIntensityDistribution,
  compareIntensityDistributionOutputSchema,
} from "./tools/intensity-distribution.js";
import {
  getTrainingWeekSummarySchema,
  getTrainingWeekSummary,
  getTrainingWeekSummaryOutputSchema,
} from "./tools/training-week.js";
import {
  getCoachingContextSchema,
  getCoachingContext,
  getCoachingContextOutputSchema,
} from "./tools/coaching-context.js";
import {
  computePowerProfileSchema,
  computePowerProfile,
} from "./tools/power-profile.js";
import {
  listWorkoutLibrarySchema,
  listWorkoutLibrary,
  listWorkoutLibraryOutputSchema,
  getWorkoutLibraryItemSchema,
  getWorkoutLibraryItem,
  syncWorkoutLibrarySchema,
  syncWorkoutLibrary,
  syncWorkoutLibraryOutputSchema,
} from "./tools/workout-library.js";

export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export const MUTATING: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export const UPSERT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export type ToolDef = {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  annotations: ToolAnnotations;
  outputSchema: z.ZodObject<z.ZodRawShape> | null;
  handler: (client: IIntervalsClient, args: unknown) => Promise<unknown>;
};

export const TOOLS: ToolDef[] = [
  // Athlete
  {
    name: "get_athlete",
    description:
      "Get the athlete's profile including FTP, LTHR, weight, max HR, resting HR, " +
      "power/HR/pace zones, and sport-specific settings. " +
      "Use this to understand the athlete's current fitness parameters for training plan creation. " +
      "Returns the full athlete object — relevant fields include icu_ftp, icu_lthr, " +
      "weight, sportSettings (FTP/zones per sport).",
    schema: getAthleteSchema,
    annotations: READ_ONLY,
    outputSchema: null,
    handler: (client, _args) => getAthlete(client),
  },

  // Activities
  {
    name: "get_activities",
    description:
      "List activities in a date range with summary metrics (TSS, IF, NP, duration, distance, HR, power). " +
      "Use this to review recent training history. " +
      "Date range max 365 days; results capped at 'limit' (default 50, max 200). " +
      "Returns: { total, count, truncated, activities: [...] }.",
    schema: getActivitiesSchema,
    annotations: READ_ONLY,
    outputSchema: getActivitiesOutputSchema,
    handler: (client, args) =>
      getActivities(client, args as z.infer<typeof getActivitiesSchema>),
  },
  {
    name: "get_activity",
    description:
      "Get full details for a single activity including metrics, and optionally its laps/intervals. " +
      "Set includeIntervals=true to add a compact interval analysis: " +
      "`intervals[]` (one slim entry per lap: i, type, label, start, dur, avgW, maxW, hr, cadence, grp), " +
      "`groups[]` (laps with the same signature collapsed into one entry — `count` is how many, " +
      "so a 4x2min block appears as one group with count:4; `sig` matches each lap's `grp`), and " +
      '`interval_summary[]` (human strings like "4x 2m 369w"). To find a structured workout\'s ' +
      "efforts, read `groups`/`interval_summary` for the structure, then `intervals` for per-rep detail.",
    schema: getActivitySchema,
    annotations: READ_ONLY,
    outputSchema: null,
    handler: (client, args) =>
      getActivity(client, args as z.infer<typeof getActivitySchema>),
  },
  {
    name: "get_activity_streams",
    description:
      "Get raw time-series data for an activity (power, heart rate, cadence, speed, altitude). " +
      "Use types parameter to request specific streams (recommended — fewer streams = full resolution). " +
      'Example: types=["watts", "heartrate"] for a power+HR analysis. ' +
      "Long activities are downsampled by an index stride to fit a size budget, preserving " +
      "whole-ride coverage at lower resolution. " +
      "Returns: { samples, original_samples, downsampled, stride, streams: { watts: number[], ... } }.",
    schema: getActivityStreamsSchema,
    annotations: READ_ONLY,
    outputSchema: null,
    handler: (client, args) =>
      getActivityStreams(
        client,
        args as z.infer<typeof getActivityStreamsSchema>
      ),
  },

  // Events (calendar)
  {
    name: "get_events",
    description:
      "List calendar events (planned workouts, races, notes) in a date range. " +
      "Use this to see what's already scheduled on the athlete's calendar. " +
      "Date range max 365 days; results capped at 'limit' (default 50, max 200). " +
      "Returns: { total, count, truncated, events: [...] }.",
    schema: getEventsSchema,
    annotations: READ_ONLY,
    outputSchema: getEventsOutputSchema,
    handler: (client, args) =>
      getEvents(client, args as z.infer<typeof getEventsSchema>),
  },
  {
    name: "get_event",
    description:
      "Get details of a single calendar event including workout description/structure. " +
      "Returns an IntervalsEvent (id, category, type, name, description, start_date_local).",
    schema: getEventSchema,
    annotations: READ_ONLY,
    outputSchema: null,
    handler: (client, args) =>
      getEvent(client, args as z.infer<typeof getEventSchema>),
  },
  {
    name: "update_event",
    description:
      "Update an existing calendar event. Can modify name, description, date, category, type, or color. " +
      "Returns the updated IntervalsEvent.",
    schema: updateEventSchema,
    annotations: MUTATING,
    outputSchema: null,
    handler: (client, args) =>
      updateEvent(client, args as z.infer<typeof updateEventSchema>),
  },
  {
    name: "delete_events",
    description:
      "Delete one or more calendar events. Each item must specify exactly one of " +
      "{ id } or { external_id }. Cannot be undone. " +
      "Returns: { success: true, deleted: N }.",
    schema: deleteEventsSchema,
    annotations: MUTATING,
    outputSchema: deleteEventsOutputSchema,
    handler: (client, args) =>
      deleteEvents(client, args as z.infer<typeof deleteEventsSchema>),
  },

  // Workouts (create)
  {
    name: "create_workout",
    description:
      "Create a structured workout on the athlete's Intervals.icu calendar. " +
      "IMPORTANT: When the user specifies power targets in watts, always use absolute watts " +
      '(e.g. "200w", "160w-256w") — do NOT convert to percentages. ' +
      'Percentage targets like "75%" are relative to FTP which may not match the user\'s intent. ' +
      "Supports simple steps, ramps, and repeat blocks. " +
      "Idempotent on externalId — same externalId upserts the existing event. " +
      "Returns: { success: true, created: N, events: [...] }.",
    schema: createWorkoutSchema,
    annotations: UPSERT,
    outputSchema: createWorkoutOutputSchema,
    handler: (client, args) =>
      createWorkout(client, args as z.infer<typeof createWorkoutSchema>),
  },
  {
    name: "create_strength_workout",
    description:
      "Create a strength/gym session on the athlete's Intervals.icu calendar as a WeightTraining event. " +
      "Provide a free-form description of exercises, sets, reps, load, and RPE. " +
      "Use this instead of create_workout for gym/strength sessions. " +
      "Idempotent on externalId — same externalId upserts the existing event. " +
      "Returns: { success: true, created: N, events: [...] }.",
    schema: createStrengthWorkoutSchema,
    annotations: UPSERT,
    outputSchema: createWorkoutOutputSchema,
    handler: (client, args) =>
      createStrengthWorkout(
        client,
        args as z.infer<typeof createStrengthWorkoutSchema>
      ),
  },

  // Workout library
  {
    name: "list_workout_library",
    description:
      "List the athlete's saved workouts (folders + workouts with name and a one-line summary). " +
      "Use this BEFORE composing an ad-hoc session so you reuse the athlete's curated templates. " +
      'Optional "folder" arg filters by folder name. ' +
      "Each workout carries a `purpose` saying what it is FOR — use that to pick the right one. " +
      "`hasTemplate` marks workouts maintained by sync_workout_library. " +
      "Returns: { folders: [...], workouts: [{ id, name, folder_id, stepCount, totalSeconds, hasTemplate, purpose, oneLine }] }.",
    schema: listWorkoutLibrarySchema,
    annotations: READ_ONLY,
    outputSchema: listWorkoutLibraryOutputSchema,
    handler: (client, args) =>
      listWorkoutLibrary(
        client,
        args as z.infer<typeof listWorkoutLibrarySchema>
      ),
  },
  {
    name: "get_workout_library_item",
    description:
      "Get the full body of a saved workout: prose rationale, steps and provenance. " +
      "Returns: { workout, description_text, seedId, summary } where seedId names the template " +
      "the workout is rendered from (null when nothing manages it).",
    schema: getWorkoutLibraryItemSchema,
    annotations: READ_ONLY,
    outputSchema: null,
    handler: (client, args) =>
      getWorkoutLibraryItem(
        client,
        args as z.infer<typeof getWorkoutLibraryItemSchema>
      ),
  },
  {
    name: "sync_workout_library",
    description:
      "Reconcile the Intervals.icu library against the tracked Workout templates. " +
      "The template files are the source of truth: each is rendered at the supplied " +
      "MAP/FTP and upserted, matched by its template marker — creating what is missing, " +
      "updating what changed (steps, prose, name or folder), and re-anchoring watts when " +
      "MAP or FTP has moved. Run it after editing a template AND after a new test result. " +
      "Never deletes: a library workout whose template has gone is reported as an orphan. " +
      "Hand edits made in the Intervals.icu UI are overwritten — edit the template file instead. " +
      "Use dryRun=true to preview. " +
      "Returns: { dryRun, created, updated, unchanged, skipped, orphans, warnings }.",
    schema: syncWorkoutLibrarySchema,
    annotations: UPSERT,
    outputSchema: syncWorkoutLibraryOutputSchema,
    handler: (client, args) =>
      syncWorkoutLibrary(
        client,
        args as z.infer<typeof syncWorkoutLibrarySchema>
      ),
  },

  // Wellness & fitness
  {
    name: "get_wellness",
    description:
      "Get wellness data for a date range including CTL (fitness), ATL (fatigue), " +
      "weight, resting HR, HRV, sleep, and subjective metrics (fatigue, mood, motivation). " +
      "Use this to understand training load trends and recovery status. " +
      "Date range max 365 days; results capped at 'limit' (default 50, max 200). " +
      "Returns: { total, count, truncated, records: [...] }.",
    schema: getWellnessSchema,
    annotations: READ_ONLY,
    outputSchema: getWellnessOutputSchema,
    handler: (client, args) =>
      getWellness(client, args as z.infer<typeof getWellnessSchema>),
  },
  {
    name: "get_fitness_summary",
    description:
      "Get today's fitness snapshot — current CTL (fitness), ATL (fatigue), TSB (form), " +
      "HRV, sleep, and subjective metrics. Quick way to assess current readiness. " +
      "Returns a WellnessRecord (ctl, atl, rampRate, restingHR, hrv, sleepSecs, readiness, ...).",
    schema: getFitnessSummarySchema,
    annotations: READ_ONLY,
    outputSchema: null,
    handler: (client, _args) => getFitnessSummary(client),
  },

  // Power curves
  {
    name: "get_power_curve",
    description:
      "Get the athlete's power-duration curve from Intervals.icu. " +
      "Shows best power at each duration (5s through 3+ hours). " +
      'Use range parameter: "90d", "1y", "all", or "r.YYYY-MM-DD.YYYY-MM-DD" for custom. ' +
      'Example: range="r.2026-01-01.2026-03-31" for Q1 2026. ' +
      "Essential for identifying strengths/weaknesses and setting training targets. " +
      "Returns: { points: [...] } (or a truncation envelope if too large).",
    schema: getPowerCurveSchema,
    annotations: READ_ONLY,
    outputSchema: null,
    handler: (client, args) =>
      getPowerCurve(client, args as z.infer<typeof getPowerCurveSchema>),
  },

  // Analysis
  {
    name: "get_aerobic_decoupling",
    description:
      "Calculate aerobic decoupling (Pw:Hr ratio) for an activity. " +
      "Compares HR:power ratio between first and second halves of a ride. " +
      "<5% = good aerobic fitness, 5-10% = developing, >10% = needs work. " +
      "Useful for assessing aerobic base fitness from steady-state efforts. " +
      "Returns: { firstHalf, secondHalf, decouplingPercent, interpretation }.",
    schema: getAerobicDecouplingSchema,
    annotations: READ_ONLY,
    outputSchema: getAerobicDecouplingOutputSchema,
    handler: (client, args) =>
      getAerobicDecoupling(
        client,
        args as z.infer<typeof getAerobicDecouplingSchema>
      ),
  },
  {
    name: "compute_power_profile",
    description:
      "Compute the cyclecoach.com power-profile report (Ric Stern) for the connected " +
      "athlete. Pulls MAP (from latest 'MAP ramp test' activity), body mass, FTP, " +
      "sex, age, height, and 5s/60s/5min peak power from Intervals.icu by default; " +
      "every input can be overridden. " +
      "Returns CycleCoach training zones, FTP-vs-MAP sanity check, VO₂max + " +
      "classification, allometric MAP benchmark, Compound Score, PSTS (with CdA), " +
      "TrainingPeaks power profile, rider-type shape, MAP band, TT power estimates, " +
      "and road race/crit estimates. Each section includes a verbatim narrative " +
      "from the source page so coaching context isn't lost.",
    schema: computePowerProfileSchema,
    annotations: READ_ONLY,
    outputSchema: null,
    handler: (client, args) =>
      computePowerProfile(
        client,
        args as z.infer<typeof computePowerProfileSchema>
      ),
  },
  {
    name: "compare_intervals",
    description:
      "Compare intervals across multiple activities side-by-side. " +
      "Shows power, HR, cadence, and duration for each interval. " +
      "Optional filters: minPower (watts), targetDuration (seconds), durationTolerance (fraction). " +
      "Example: targetDuration=300, durationTolerance=0.2 finds all 4-6 minute intervals. " +
      "Useful for tracking interval progression over time. " +
      "Returns: { intervals: [{ lapNumber, values: [...] }], summaries: [...] }.",
    schema: compareIntervalsSchema,
    annotations: READ_ONLY,
    outputSchema: compareIntervalsOutputSchema,
    handler: (client, args) =>
      compareIntervalsHandler(
        client,
        args as z.infer<typeof compareIntervalsSchema>
      ),
  },

  {
    name: "compare_planned_vs_actual",
    description:
      "Verify whether a session was executed as prescribed. " +
      "Pairs a completed activity with its planned event (supply exactly one of " +
      "activityId or eventId — the other is resolved via the activity's paired event) " +
      "and reports, per planned step, the prescribed duration and power target " +
      "beside the delivered duration and average power, the deltas, and a verdict " +
      "(on-target / over / under / not-attempted / unmatched). Repeat blocks are " +
      "compared rep by rep, so decay across reps is visible. " +
      "Steps are compared against the laps the head unit recorded, read from the " +
      "original upload — the faithful record of what the athlete marked. " +
      "Intervals.icu's own icu_intervals analysis is derived and editable and can " +
      "re-cut rep boundaries, so it is used only when laps are unavailable (no FIT " +
      "file, or the ride was never lapped) or cannot explain the session. " +
      "executionRecord names which was used; executionRecordNote flags a derived " +
      "reading known to have drifted from the laps. " +
      "Alignment is deliberately conservative and reads duration only, never power: " +
      "alignmentBasis is 'sequential' (matched in order), 'duration' (partial match), " +
      "or 'none' (declined to guess). A 'none' result still returns the roll-up. " +
      "Refusals are explicit via reason: no-paired-event, no-paired-activity, " +
      "no-structured-steps, no-intervals, alignment-failed. " +
      "Optional tolerance (fraction, default 0.05) applies to point targets only; " +
      "range targets are judged on their own band. " +
      "Returns: { executionRecord, executionRecordNote?, alignmentBasis, matchedFraction, " +
      "tolerance, steps: [...], " +
      "rollup: { plannedLoad, actualLoad, platformCompliance, unplannedIntervals }, reason? }.",
    schema: comparePlannedVsActualSchema,
    annotations: READ_ONLY,
    outputSchema: comparePlannedVsActualOutputSchema,
    handler: (client, args) =>
      comparePlannedVsActual(
        client,
        args as z.infer<typeof comparePlannedVsActualSchema>
      ),
  },

  {
    name: "compare_intensity_distribution",
    description:
      "Answer whether the prescribed dose was actually delivered, as time at " +
      "intensity. The companion to compare_planned_vs_actual, not a replacement: " +
      "that tool says what happened within reps, this one says how much of the " +
      "prescribed dose landed. " +
      "Both sides are computed here — the planned distribution from the event's " +
      "own workout steps and the delivered one from the recorded power stream — " +
      "never read from the platform's precomputed zone times, which are snapshots " +
      "taken at authoring and at upload and can disagree for reasons unrelated to " +
      "what was ridden. Because workouts are authored in absolute watts, a threshold " +
      "change between prescribing and riding does not affect the comparison. " +
      "Needs no step-to-interval alignment, so it works where compare_planned_vs_actual " +
      "returns alignmentBasis 'none': track sessions, auto-lapped rides, abandoned sessions. " +
      "Bucketing frame is a partition derived from the athlete's MAP coaching zones " +
      "(which overlap, so each wattage is assigned to the highest zone whose floor it " +
      "reaches); the boundaries used are reported with every result. The middle band " +
      "(76–106% FTP) is reported separately from its own bounds, not by summing zones — " +
      "it is the coaching philosophy's primary judge of a build week. " +
      "Delivered seconds sum to recording time, not elapsed time: paused time belongs " +
      "to no zone. Range targets are bucketed by midpoint, and any step whose range " +
      "straddled a boundary is reported. " +
      "Two forms: single session (exactly one of activityId or eventId) or date range " +
      "(oldest and newest, max 28 days) which sums across paired sessions and lists " +
      "per-session middle-band figures plus the sessions excluded from the sums. " +
      "Refusals are explicit via reason: no-paired-event, no-paired-activity, " +
      "no-structured-steps, no-recorded-power, no-coaching-zones. " +
      "Returns: { boundaries, zones: [{ zone, plannedSeconds, deliveredSeconds, " +
      "deltaSeconds }], middleBand, boundarySpanningSteps, unbucketedSteps, reason? } " +
      "or, for a range, { zones, middleBand, sessions: [...], excluded: [...] }.",
    schema: compareIntensityDistributionSchema,
    annotations: READ_ONLY,
    outputSchema: compareIntensityDistributionOutputSchema,
    handler: (client, args) =>
      compareIntensityDistribution(
        client,
        args as z.infer<typeof compareIntensityDistributionSchema>
      ),
  },

  {
    name: "compute_track_lap_power",
    description:
      "Join a track lap-timer export to the activity's streams and return per-lap " +
      "power, cadence and heart rate for each scored run, with the rolling entry " +
      "excluded. Alignment is fitted by matching recorded cadence to the cadence each " +
      "lap time implies, so every run reports its fit residual (rpm), the offset " +
      "interval the fit cannot separate, and a verdict — a weak or ambiguous " +
      "alignment withholds per-lap readings rather than returning plausible fiction. " +
      "The drivetrain rollout is fitted, not assumed, and returned. " +
      "Pass `splits` as the export text: run, cumulative distance, cumulative time, " +
      "lap time. Returns: { runs: [{ run, startOffsetSeconds, fittedRolloutMeters, " +
      "confidence, average, laps }], rolloutAgreement, thresholds }.",
    schema: computeTrackLapPowerSchema,
    annotations: READ_ONLY,
    outputSchema: computeTrackLapPowerOutputSchema,
    handler: (client, args) =>
      computeTrackLapPower(
        client,
        args as z.infer<typeof computeTrackLapPowerSchema>
      ),
  },

  // Workflow
  {
    name: "get_training_week_summary",
    description:
      "Get a complete training week snapshot in one call: completed activities, " +
      "wellness/fitness trends (CTL/ATL/TSB), and planned events for the upcoming days. " +
      "Provide weekStart (Monday) in YYYY-MM-DD; defaults to current week. " +
      "Use this for weekly review or planning the next week. " +
      "Saves the multi-call dance of get_activities + get_wellness + get_events. " +
      "Returns: { week, totals, by_sport, fitness: { ctl, atl, tsb }, " +
      "completed_activities: [...], events: [...] }.",
    schema: getTrainingWeekSummarySchema,
    annotations: READ_ONLY,
    outputSchema: getTrainingWeekSummaryOutputSchema,
    handler: (client, args) =>
      getTrainingWeekSummary(
        client,
        args as z.infer<typeof getTrainingWeekSummarySchema>
      ),
  },

  // Coaching context
  {
    name: "get_coaching_context",
    description:
      "Get a single snapshot of the athlete's current coaching state — profile " +
      "(FTP, LTHR, max/resting HR, weight, power/HR zones), today's fitness " +
      "(CTL, ATL, TSB, ramp rate), a wellness trend (default 7d, max 30d) " +
      "with subjective metrics (fatigue, soreness, motivation, mood, sleep), " +
      "and a derived MAP (Maximal Aerobic Power) value. " +
      "MAP is computed as the best-60s power from the most recent activity " +
      'whose name starts with "MAP ramp test" in the last 90 days. To exclude ' +
      'a botched test, rename the activity in Intervals.icu to include "(skip)". ' +
      "If no qualifying test is found, map is null and mapWarning explains. " +
      "Call this at session start to ground workout decisions in current state " +
      "rather than juggling get_athlete + get_wellness + get_fitness_summary " +
      "yourself. " +
      "Returns: { asOf, daysWindow, athlete, fitness, wellnessTrend, map, mapWarning? }.",
    schema: getCoachingContextSchema,
    annotations: READ_ONLY,
    outputSchema: getCoachingContextOutputSchema,
    handler: (client, args) =>
      getCoachingContext(
        client,
        args as z.infer<typeof getCoachingContextSchema>
      ),
  },
];
