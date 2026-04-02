import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IIntervalsClient } from "../index.js";
import { logResponse, logError } from "./logger.js";
import {
  createWorkoutSchema,
  createWorkout,
  createStrengthWorkoutSchema,
  createStrengthWorkout,
} from "./tools/workouts.js";
import { getAthleteSchema, getAthlete } from "./tools/athlete.js";
import {
  getActivitiesSchema,
  getActivities,
  getActivitySchema,
  getActivity,
  getActivityStreamsSchema,
  getActivityStreams,
} from "./tools/activities.js";
import {
  getEventsSchema,
  getEvents,
  getEventSchema,
  getEvent,
  updateEventSchema,
  updateEvent,
  deleteEventsSchema,
  deleteEvents,
} from "./tools/events.js";
import {
  getWellnessSchema,
  getWellness,
  getFitnessSummarySchema,
  getFitnessSummary,
} from "./tools/wellness.js";
import { getPowerCurveSchema, getPowerCurve } from "./tools/power.js";
import {
  getAerobicDecouplingSchema,
  getAerobicDecoupling,
  compareIntervalsSchema,
  compareIntervalsHandler,
} from "./tools/analysis.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function createMcpServer(client: IIntervalsClient): McpServer {
  const server = new McpServer({
    name: "intervals-icu-mcp",
    version,
  });

  function tool(
    name: string,
    description: string,
    schema: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => Promise<string>
  ): void {
    server.tool(
      name,
      description,
      schema,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (args: any): Promise<ToolResult> => {
        const start = Date.now();
        try {
          const content = await handler(args);
          logResponse(name, content, Date.now() - start);
          return { content: [{ type: "text", text: content }] };
        } catch (error) {
          logError(name, error as Error, Date.now() - start);
          throw error;
        }
      }
    );
  }

  // Athlete
  tool(
    "get_athlete",
    "Get the athlete's profile including FTP, LTHR, weight, max HR, resting HR, " +
      "power/HR/pace zones, and sport-specific settings. " +
      "Use this to understand the athlete's current fitness parameters for training plan creation.",
    getAthleteSchema.shape,
    () => getAthlete(client)
  );

  // Activities
  tool(
    "get_activities",
    "List activities in a date range with summary metrics (TSS, IF, NP, duration, distance, HR, power). " +
      "Use this to review recent training history.",
    getActivitiesSchema.shape,
    (args) => getActivities(client, args)
  );

  tool(
    "get_activity",
    "Get full details for a single activity including metrics, and optionally detected intervals. " +
      "Set includeIntervals=true to get interval-by-interval breakdown.",
    getActivitySchema.shape,
    (args) => getActivity(client, args)
  );

  tool(
    "get_activity_streams",
    "Get raw time-series data for an activity (power, heart rate, cadence, speed, altitude). " +
      "Use types parameter to request specific streams. Useful for detailed analysis.",
    getActivityStreamsSchema.shape,
    (args) => getActivityStreams(client, args)
  );

  // Events (calendar)
  tool(
    "get_events",
    "List calendar events (planned workouts, races, notes) in a date range. " +
      "Use this to see what's already scheduled on the athlete's calendar.",
    getEventsSchema.shape,
    (args) => getEvents(client, args)
  );

  tool(
    "get_event",
    "Get details of a single calendar event including workout description/structure.",
    getEventSchema.shape,
    (args) => getEvent(client, args)
  );

  tool(
    "update_event",
    "Update an existing calendar event. Can modify name, description, date, category, type, or color.",
    updateEventSchema.shape,
    (args) => updateEvent(client, args)
  );

  tool(
    "delete_events",
    "Delete one or more calendar events by ID or external_id.",
    deleteEventsSchema.shape,
    (args) => deleteEvents(client, args)
  );

  // Workouts (create)
  tool(
    "create_workout",
    "Create a structured workout on the athlete's Intervals.icu calendar. " +
      "IMPORTANT: When the user specifies power targets in watts, always use absolute watts " +
      '(e.g. "200w", "160w-256w") — do NOT convert to percentages. ' +
      'Percentage targets like "75%" are relative to FTP which may not match the user\'s intent. ' +
      "Supports simple steps, ramps, and repeat blocks.",
    createWorkoutSchema.shape,
    (args) => createWorkout(client, args)
  );

  tool(
    "create_strength_workout",
    "Create a strength/gym session on the athlete's Intervals.icu calendar as a WeightTraining event. " +
      "Provide a free-form description of exercises, sets, reps, load, and RPE. " +
      "Use this instead of create_workout for gym/strength sessions.",
    createStrengthWorkoutSchema.shape,
    (args) => createStrengthWorkout(client, args)
  );

  // Wellness & fitness
  tool(
    "get_wellness",
    "Get wellness data for a date range including CTL (fitness), ATL (fatigue), " +
      "weight, resting HR, HRV, sleep, and subjective metrics (fatigue, mood, motivation). " +
      "Use this to understand training load trends and recovery status.",
    getWellnessSchema.shape,
    (args) => getWellness(client, args)
  );

  tool(
    "get_fitness_summary",
    "Get today's fitness snapshot — current CTL (fitness), ATL (fatigue), TSB (form), " +
      "HRV, sleep, and subjective metrics. Quick way to assess current readiness.",
    getFitnessSummarySchema.shape,
    () => getFitnessSummary(client)
  );

  // Power curves
  tool(
    "get_power_curve",
    "Get the athlete's power-duration curve from Intervals.icu. " +
      "Shows best power at each duration (5s through 3+ hours). " +
      'Use range parameter: "90d", "1y", "all", or "r.YYYY-MM-DD.YYYY-MM-DD" for custom. ' +
      "Essential for identifying strengths/weaknesses and setting training targets.",
    getPowerCurveSchema.shape,
    (args) => getPowerCurve(client, args)
  );

  // Analysis
  tool(
    "get_aerobic_decoupling",
    "Calculate aerobic decoupling (Pw:Hr ratio) for an activity. " +
      "Compares HR:power ratio between first and second halves of a ride. " +
      "<5% = good aerobic fitness, 5-10% = developing, >10% = needs work. " +
      "Useful for assessing aerobic base fitness from steady-state efforts.",
    getAerobicDecouplingSchema.shape,
    (args) => getAerobicDecoupling(client, args)
  );

  tool(
    "compare_intervals",
    "Compare intervals across multiple activities side-by-side. " +
      "Shows power, HR, cadence, and duration for each interval. " +
      "Optional filters: minPower (watts), targetDuration (seconds), durationTolerance (fraction). " +
      "Useful for tracking interval progression over time.",
    compareIntervalsSchema.shape,
    (args) => compareIntervalsHandler(client, args)
  );

  return server;
}
