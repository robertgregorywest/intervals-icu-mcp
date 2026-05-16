import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { IIntervalsClient } from "../index.js";
import { HttpError } from "../client.js";
import { logResponse, logError } from "./logger.js";
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
import { STATIC_INSTRUCTIONS } from "./syntax-doc.js";
import { registerSetupCoachingPrompt } from "./prompts/setup-coaching.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const MUTATING: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

const UPSERT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export function createMcpServer(client: IIntervalsClient): McpServer {
  const server = new McpServer(
    {
      name: "intervals-icu-mcp",
      version,
    },
    { instructions: STATIC_INSTRUCTIONS }
  );

  function tool<S extends z.ZodRawShape>(
    name: string,
    description: string,
    schema: z.ZodObject<S>,
    annotations: ToolAnnotations,
    outputSchema: z.ZodObject<z.ZodRawShape> | null,
    handler: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>
  ): void {
    const config: Record<string, unknown> = {
      description,
      inputSchema: schema.shape,
      annotations,
    };
    if (outputSchema) {
      config.outputSchema = outputSchema;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cb = async (args: any) => {
      const start = Date.now();
      try {
        const data = await handler(args as z.infer<z.ZodObject<S>>);
        const text = JSON.stringify(data, null, 2);
        logResponse(name, text, Date.now() - start);
        const result: Record<string, unknown> = {
          content: [{ type: "text" as const, text }],
        };
        if (outputSchema && isPlainObject(data)) {
          result.structuredContent = data;
        }
        return result;
      } catch (error) {
        const err = error as Error;
        logError(name, err, Date.now() - start);
        return {
          isError: true,
          content: [{ type: "text" as const, text: formatToolError(err) }],
        };
      }
    };

    server.registerTool(
      name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cb as any
    );
  }

  // Athlete
  tool(
    "get_athlete",
    "Get the athlete's profile including FTP, LTHR, weight, max HR, resting HR, " +
      "power/HR/pace zones, and sport-specific settings. " +
      "Use this to understand the athlete's current fitness parameters for training plan creation. " +
      "Returns the full athlete object — relevant fields include icu_ftp, icu_lthr, " +
      "weight, sportSettings (FTP/zones per sport).",
    getAthleteSchema,
    READ_ONLY,
    null,
    () => getAthlete(client)
  );

  // Activities
  tool(
    "get_activities",
    "List activities in a date range with summary metrics (TSS, IF, NP, duration, distance, HR, power). " +
      "Use this to review recent training history. " +
      "Date range max 365 days; results capped at 'limit' (default 50, max 200). " +
      "Returns: { total, count, truncated, activities: [...] }.",
    getActivitiesSchema,
    READ_ONLY,
    getActivitiesOutputSchema,
    (args) => getActivities(client, args)
  );

  tool(
    "get_activity",
    "Get full details for a single activity including metrics, and optionally detected intervals. " +
      "Set includeIntervals=true to get interval-by-interval breakdown. " +
      "Returns an Activity object (icu_training_load, icu_intensity, icu_average_watts, " +
      "average_heartrate, distance, moving_time, plus icu_intervals[] when requested).",
    getActivitySchema,
    READ_ONLY,
    null,
    (args) => getActivity(client, args)
  );

  tool(
    "get_activity_streams",
    "Get raw time-series data for an activity (power, heart rate, cadence, speed, altitude). " +
      "Use types parameter to request specific streams (recommended — full streams are large). " +
      'Example: types=["watts", "heartrate"] for a power+HR analysis. ' +
      "Long activities may exceed the character limit; check 'truncated' field in response. " +
      "Returns: { watts: number[], heartrate: number[], ... } indexed by sample.",
    getActivityStreamsSchema,
    READ_ONLY,
    null,
    (args) => getActivityStreams(client, args)
  );

  // Events (calendar)
  tool(
    "get_events",
    "List calendar events (planned workouts, races, notes) in a date range. " +
      "Use this to see what's already scheduled on the athlete's calendar. " +
      "Date range max 365 days; results capped at 'limit' (default 50, max 200). " +
      "Returns: { total, count, truncated, events: [...] }.",
    getEventsSchema,
    READ_ONLY,
    getEventsOutputSchema,
    (args) => getEvents(client, args)
  );

  tool(
    "get_event",
    "Get details of a single calendar event including workout description/structure. " +
      "Returns an IntervalsEvent (id, category, type, name, description, start_date_local).",
    getEventSchema,
    READ_ONLY,
    null,
    (args) => getEvent(client, args)
  );

  tool(
    "update_event",
    "Update an existing calendar event. Can modify name, description, date, category, type, or color. " +
      "Returns the updated IntervalsEvent.",
    updateEventSchema,
    MUTATING,
    null,
    (args) => updateEvent(client, args)
  );

  tool(
    "delete_events",
    "Delete one or more calendar events. Each item must specify exactly one of " +
      "{ id } or { external_id }. Cannot be undone. " +
      "Returns: { success: true, deleted: N }.",
    deleteEventsSchema,
    MUTATING,
    deleteEventsOutputSchema,
    (args) => deleteEvents(client, args)
  );

  // Workouts (create)
  tool(
    "create_workout",
    "Create a structured workout on the athlete's Intervals.icu calendar. " +
      "IMPORTANT: When the user specifies power targets in watts, always use absolute watts " +
      '(e.g. "200w", "160w-256w") — do NOT convert to percentages. ' +
      'Percentage targets like "75%" are relative to FTP which may not match the user\'s intent. ' +
      "Supports simple steps, ramps, and repeat blocks. " +
      "Idempotent on externalId — same externalId upserts the existing event. " +
      "Returns: { success: true, created: N, events: [...] }.",
    createWorkoutSchema,
    UPSERT,
    createWorkoutOutputSchema,
    (args) => createWorkout(client, args)
  );

  tool(
    "create_strength_workout",
    "Create a strength/gym session on the athlete's Intervals.icu calendar as a WeightTraining event. " +
      "Provide a free-form description of exercises, sets, reps, load, and RPE. " +
      "Use this instead of create_workout for gym/strength sessions. " +
      "Idempotent on externalId — same externalId upserts the existing event. " +
      "Returns: { success: true, created: N, events: [...] }.",
    createStrengthWorkoutSchema,
    UPSERT,
    createWorkoutOutputSchema,
    (args) => createStrengthWorkout(client, args)
  );

  // Workout library (saved workouts in Intervals.icu)
  tool(
    "list_workout_library",
    "List the athlete's saved workouts (folders + workouts with name and a one-line summary). " +
      "Use this BEFORE composing an ad-hoc session so you reuse the athlete's curated templates. " +
      'Optional "folder" arg filters by folder name. ' +
      "Returns: { folders: [...], workouts: [{ id, name, folder_id, stepCount, totalSeconds, hasRationale, oneLine }] }.",
    listWorkoutLibrarySchema,
    READ_ONLY,
    listWorkoutLibraryOutputSchema,
    (args) => listWorkoutLibrary(client, args)
  );

  tool(
    "get_workout_library_item",
    "Get the full body of a saved workout including its rationale (intent, %MAP/%FTP basis, source). " +
      "Returns: { workout, description_text, rationale, summary } where rationale is the parsed coaching context " +
      "(null when the workout has no embedded rationale block).",
    getWorkoutLibraryItemSchema,
    READ_ONLY,
    null,
    (args) => getWorkoutLibraryItem(client, args)
  );

  tool(
    "create_workout_library_item",
    "Author and persist a new workout to the athlete's library. Use when you've " +
      "composed a session that doesn't already exist in the library and want it " +
      "saved for reuse. Folder is created if missing (defaults to 'Coach: Custom'). " +
      "Fails if a workout with this name already exists in the target folder. " +
      "Provide a rationale block with basis/anchorWatts/seedId/intensities to make " +
      "the workout refreshable via refresh_workout_library when MAP or FTP changes. " +
      "Returns: { workoutId, name, folder, description }.",
    createWorkoutLibraryItemSchema,
    UPSERT,
    createWorkoutLibraryItemOutputSchema,
    (args) => createWorkoutLibraryItem(client, args)
  );

  tool(
    "refresh_workout_library",
    "Regenerate watts on every seeded workout in the library when MAP or FTP changes. " +
      "Walks all folders, finds workouts whose rationale block has a known seedId, and " +
      "rewrites the step body using the new anchor while preserving any free-text prose " +
      "the user has added above the steps. Skips workouts already at the new anchor. " +
      "Use dryRun=true to preview. " +
      "Returns: { dryRun, updated: [...], skipped: [...], warnings: [...] }.",
    refreshWorkoutLibrarySchema,
    UPSERT,
    refreshWorkoutLibraryOutputSchema,
    (args) => refreshWorkoutLibrary(client, args)
  );

  tool(
    "seed_workout_library",
    "Populate the athlete's library with a canonical set of cycling templates " +
      "(FTP test, MAP ramp, VO2 4x4, VO2 30/30, threshold 2x20, sweet spot 3x12, Z2, MIET, recovery). " +
      'Authors templates under a "Coach Templates" folder hierarchy. ' +
      "Provide mapWatts and/or ftpWatts to materialize templates anchored on each. " +
      "Idempotent: skips workouts whose name already exists in the target folder. " +
      "Use dryRun=true to preview without writing. " +
      "Returns: { dryRun, created: [...], skipped: [...], warnings: [...] }.",
    seedWorkoutLibrarySchema,
    UPSERT,
    seedWorkoutLibraryOutputSchema,
    (args) => seedWorkoutLibrary(client, args)
  );

  // Wellness & fitness
  tool(
    "get_wellness",
    "Get wellness data for a date range including CTL (fitness), ATL (fatigue), " +
      "weight, resting HR, HRV, sleep, and subjective metrics (fatigue, mood, motivation). " +
      "Use this to understand training load trends and recovery status. " +
      "Date range max 365 days; results capped at 'limit' (default 50, max 200). " +
      "Returns: { total, count, truncated, records: [...] }.",
    getWellnessSchema,
    READ_ONLY,
    getWellnessOutputSchema,
    (args) => getWellness(client, args)
  );

  tool(
    "get_fitness_summary",
    "Get today's fitness snapshot — current CTL (fitness), ATL (fatigue), TSB (form), " +
      "HRV, sleep, and subjective metrics. Quick way to assess current readiness. " +
      "Returns a WellnessRecord (ctl, atl, rampRate, restingHR, hrv, sleepSecs, readiness, ...).",
    getFitnessSummarySchema,
    READ_ONLY,
    null,
    () => getFitnessSummary(client)
  );

  // Power curves
  tool(
    "get_power_curve",
    "Get the athlete's power-duration curve from Intervals.icu. " +
      "Shows best power at each duration (5s through 3+ hours). " +
      'Use range parameter: "90d", "1y", "all", or "r.YYYY-MM-DD.YYYY-MM-DD" for custom. ' +
      'Example: range="r.2026-01-01.2026-03-31" for Q1 2026. ' +
      "Essential for identifying strengths/weaknesses and setting training targets. " +
      "Returns: { points: [...] } (or a truncation envelope if too large).",
    getPowerCurveSchema,
    READ_ONLY,
    null,
    (args) => getPowerCurve(client, args)
  );

  // Analysis
  tool(
    "get_aerobic_decoupling",
    "Calculate aerobic decoupling (Pw:Hr ratio) for an activity. " +
      "Compares HR:power ratio between first and second halves of a ride. " +
      "<5% = good aerobic fitness, 5-10% = developing, >10% = needs work. " +
      "Useful for assessing aerobic base fitness from steady-state efforts. " +
      "Returns: { firstHalf, secondHalf, decouplingPercent, interpretation }.",
    getAerobicDecouplingSchema,
    READ_ONLY,
    getAerobicDecouplingOutputSchema,
    (args) => getAerobicDecoupling(client, args)
  );

  tool(
    "compute_power_profile",
    "Compute the cyclecoach.com power-profile report (Ric Stern) for the connected " +
      "athlete. Pulls MAP (from latest 'MAP ramp test' activity), body mass, FTP, " +
      "sex, age, height, and 5s/60s/5min peak power from Intervals.icu by default; " +
      "every input can be overridden. " +
      "Returns CycleCoach training zones, FTP-vs-MAP sanity check, VO₂max + " +
      "classification, allometric MAP benchmark, Compound Score, PSTS (with CdA), " +
      "TrainingPeaks power profile, rider-type shape, MAP band, TT power estimates, " +
      "and road race/crit estimates. Each section includes a verbatim narrative " +
      "from the source page so coaching context isn't lost.",
    computePowerProfileSchema,
    READ_ONLY,
    null,
    (args) => computePowerProfile(client, args)
  );

  tool(
    "compare_intervals",
    "Compare intervals across multiple activities side-by-side. " +
      "Shows power, HR, cadence, and duration for each interval. " +
      "Optional filters: minPower (watts), targetDuration (seconds), durationTolerance (fraction). " +
      "Example: targetDuration=300, durationTolerance=0.2 finds all 4-6 minute intervals. " +
      "Useful for tracking interval progression over time. " +
      "Returns: { intervals: [{ lapNumber, values: [...] }], summaries: [...] }.",
    compareIntervalsSchema,
    READ_ONLY,
    compareIntervalsOutputSchema,
    (args) => compareIntervalsHandler(client, args)
  );

  // Workflow
  tool(
    "get_training_week_summary",
    "Get a complete training week snapshot in one call: completed activities, " +
      "wellness/fitness trends (CTL/ATL/TSB), and planned events for the upcoming days. " +
      "Provide weekStart (Monday) in YYYY-MM-DD; defaults to current week. " +
      "Use this for weekly review or planning the next week. " +
      "Saves the multi-call dance of get_activities + get_wellness + get_events. " +
      "Returns: { week, totals, by_sport, fitness: { ctl, atl, tsb }, " +
      "completed_activities: [...], events: [...] }.",
    getTrainingWeekSummarySchema,
    READ_ONLY,
    getTrainingWeekSummaryOutputSchema,
    (args) => getTrainingWeekSummary(client, args)
  );

  // Coaching context
  tool(
    "get_coaching_context",
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
    getCoachingContextSchema,
    READ_ONLY,
    getCoachingContextOutputSchema,
    (args) => getCoachingContext(client, args)
  );

  // Prompts
  registerSetupCoachingPrompt(server);

  return server;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatToolError(error: Error): string {
  if (error instanceof HttpError) {
    switch (error.status) {
      case 401:
      case 403:
        return (
          `Authentication failed (HTTP ${error.status}): ${error.message}. ` +
          "Check that INTERVALS_API_KEY is set correctly."
        );
      case 404:
        return (
          `Not found (HTTP 404): ${error.message}. ` +
          "Verify the resource ID exists and belongs to this athlete."
        );
      case 422:
        return (
          `Invalid request (HTTP 422): ${error.message}. ` +
          "Check parameter formats and required fields."
        );
      case 429:
        return (
          `Rate limited (HTTP 429): ${error.message}. ` +
          "Wait a moment before retrying."
        );
      default:
        if (error.status >= 500) {
          return (
            `Intervals.icu temporarily unavailable (HTTP ${error.status}): ${error.message}. ` +
            "Retry shortly."
          );
        }
        return `HTTP ${error.status}: ${error.message}`;
    }
  }
  if (error.name === "ZodError") {
    return `Validation error: ${error.message}`;
  }
  return error.message || String(error);
}
