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
  seedWorkoutLibrarySchema,
  seedWorkoutLibrary,
  seedWorkoutLibraryOutputSchema,
  refreshWorkoutLibrarySchema,
  refreshWorkoutLibrary,
  refreshWorkoutLibraryOutputSchema,
  createWorkoutLibraryItemSchema,
  createWorkoutLibraryItem,
  createWorkoutLibraryItemOutputSchema,
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
      "Returns: { folders: [...], workouts: [{ id, name, folder_id, stepCount, totalSeconds, hasRationale, oneLine }] }.",
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
      "Get the full body of a saved workout including its rationale (intent, %MAP/%FTP basis, source). " +
      "Returns: { workout, description_text, rationale, summary } where rationale is the parsed coaching context " +
      "(null when the workout has no embedded rationale block).",
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
    name: "create_workout_library_item",
    description:
      "Author and persist a new workout to the athlete's library. Use when you've " +
      "composed a session that doesn't already exist in the library and want it " +
      "saved for reuse. Folder is created if missing (defaults to 'Coach: Custom'). " +
      "Fails if a workout with this name already exists in the target folder. " +
      "Provide a rationale block with basis/anchorWatts/seedId/intensities to make " +
      "the workout refreshable via refresh_workout_library when MAP or FTP changes. " +
      "Returns: { workoutId, name, folder, description }.",
    schema: createWorkoutLibraryItemSchema,
    annotations: UPSERT,
    outputSchema: createWorkoutLibraryItemOutputSchema,
    handler: (client, args) =>
      createWorkoutLibraryItem(
        client,
        args as z.infer<typeof createWorkoutLibraryItemSchema>
      ),
  },
  {
    name: "refresh_workout_library",
    description:
      "Regenerate watts on every seeded workout in the library when MAP or FTP changes. " +
      "Walks all folders, finds workouts whose rationale block has a known seedId, and " +
      "rewrites the step body using the new anchor while preserving any free-text prose " +
      "the user has added above the steps. Skips workouts already at the new anchor. " +
      "Use dryRun=true to preview. " +
      "Returns: { dryRun, updated: [...], skipped: [...], warnings: [...] }.",
    schema: refreshWorkoutLibrarySchema,
    annotations: UPSERT,
    outputSchema: refreshWorkoutLibraryOutputSchema,
    handler: (client, args) =>
      refreshWorkoutLibrary(
        client,
        args as z.infer<typeof refreshWorkoutLibrarySchema>
      ),
  },
  {
    name: "seed_workout_library",
    description:
      "Populate the athlete's library with a canonical set of cycling templates " +
      "(FTP test, MAP ramp, VO2 4x4, VO2 30/30, threshold 2x20, sweet spot 3x12, Z2, MIET, recovery). " +
      'Authors templates under a "Coach Templates" folder hierarchy. ' +
      "Provide mapWatts and/or ftpWatts to materialize templates anchored on each. " +
      "Idempotent: skips workouts whose name already exists in the target folder. " +
      "Use dryRun=true to preview without writing. " +
      "Returns: { dryRun, created: [...], skipped: [...], warnings: [...] }.",
    schema: seedWorkoutLibrarySchema,
    annotations: UPSERT,
    outputSchema: seedWorkoutLibraryOutputSchema,
    handler: (client, args) =>
      seedWorkoutLibrary(
        client,
        args as z.infer<typeof seedWorkoutLibrarySchema>
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
