import "dotenv/config";
import {
  TrainingPeaksClient,
  type WorkoutSummary,
  type StrengthWorkoutSummary,
} from "trainingpeaks-mcp";
import { IntervalsClient, type SportType } from "../src/index.js";

// --- FIT decoding (inline to avoid deep imports into trainingpeaks-mcp) ---

interface FitStepMsg {
  messageIndex?: number;
  wktStepName?: string;
  intensity?: unknown;
  durationType?: unknown;
  durationValue?: unknown;
  durationTime?: unknown;
  durationDistance?: unknown;
  durationStep?: unknown;
  targetType?: unknown;
  targetValue?: unknown;
  customTargetValueLow?: unknown;
  customTargetValueHigh?: unknown;
  customTargetLow?: unknown;
  customTargetHigh?: unknown;
  repeatSteps?: unknown;
  repeatTimes?: unknown;
}

interface FitMessages {
  workoutStepMesgs?: FitStepMsg[];
  [key: string]: unknown;
}

async function decodeFitBuffer(buffer: Buffer): Promise<FitMessages> {
  const { Decoder, Stream } = await import("@garmin/fitsdk");
  const stream = Stream.fromBuffer(buffer);
  const decoder = new Decoder(stream);
  if (!decoder.isFIT() || !decoder.checkIntegrity()) {
    throw new Error("Invalid FIT file");
  }
  const { messages } = decoder.read();
  return messages as FitMessages;
}

// --- CLI args ---

interface Args {
  start: string;
  end: string;
  dryRun: boolean;
  batchSize: number;
  noStructure: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let start = "";
  let end = "";
  let dryRun = false;
  let batchSize = 50;
  let noStructure = false;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--start":
        start = argv[++i];
        break;
      case "--end":
        end = argv[++i];
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--batch-size":
        batchSize = parseInt(argv[++i], 10);
        break;
      case "--no-structure":
        noStructure = true;
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }

  if (!start || !end) {
    console.error(
      "Usage: migrate-from-tp --start YYYY-MM-DD --end YYYY-MM-DD [--dry-run] [--batch-size N] [--no-structure]"
    );
    process.exit(1);
  }

  return { start, end, dryRun, batchSize, noStructure };
}

// --- Sport type mapping ---

const SPORT_MAP: Record<string, SportType> = {
  Bike: "Ride",
  Run: "Run",
  Swim: "Swim",
  Walk: "Hike",
  Strength: "WeightTraining",
  CrossTrain: "WeightTraining",
};

const SKIP_TYPES = new Set(["Brick", "RestDay"]);

function mapSportType(tpType: string): SportType | null {
  if (SKIP_TYPES.has(tpType)) return null;
  const mapped = SPORT_MAP[tpType];
  if (!mapped) {
    console.warn(`  ⚠ Unknown sport type "${tpType}", mapping to Ride`);
    return "Ride";
  }
  return mapped;
}

// --- External ID ---

function workoutExternalId(workoutId: number): string {
  return `tp-migrate-${workoutId}`;
}

function strengthExternalId(workoutId: string): string {
  return `tp-migrate-str-${workoutId}`;
}

// --- Duration / metric formatting ---

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  if (h > 0 && m > 0 && s > 0) return `${h}h${m}m${s}s`;
  if (h > 0 && m > 0) return `${h}h${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0 && s > 0) return `${m}m${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km === Math.floor(km) ? `${km}km` : `${km.toFixed(1)}km`;
  }
  return `${Math.round(meters)}mtr`;
}

function formatMetricsLine(
  label: string,
  time?: number,
  distance?: number,
  tss?: number,
  intensityFactor?: number,
  energy?: number
): string | null {
  const parts: string[] = [];
  if (time != null) parts.push(formatDuration(time));
  if (distance != null) parts.push(formatDistance(distance));
  if (tss != null) parts.push(`TSS ${Math.round(tss)}`);
  if (intensityFactor != null) parts.push(`IF ${intensityFactor.toFixed(2)}`);
  if (energy != null) parts.push(`${Math.round(energy)} kJ`);
  if (parts.length === 0) return null;
  return `${label}: ${parts.join(" | ")}`;
}

// --- Plan step → Intervals.icu workout text ---

const INTENSITY_LABELS: Record<string, string> = {
  warmup: "Warm Up",
  cooldown: "Cool Down",
  rest: "Rest",
  recover: "Recovery",
};

function normaliseEnum(val: unknown): string {
  if (typeof val === "string") return val.toLowerCase().replace(/[_\s]/g, "");
  if (typeof val === "number") return String(val);
  return "";
}

function numOrUndef(val: unknown): number | undefined {
  return typeof val === "number" && isFinite(val) ? val : undefined;
}

function formatStepDuration(raw: FitStepMsg): string | null {
  const durType = normaliseEnum(raw.durationType);
  if (durType === "time") {
    const secs = numOrUndef(raw.durationTime) ?? numOrUndef(raw.durationValue);
    if (secs != null) return formatDuration(secs);
  } else if (durType === "distance") {
    const meters =
      numOrUndef(raw.durationDistance) ?? numOrUndef(raw.durationValue);
    if (meters != null) return formatDistance(meters);
  } else if (durType === "open") {
    return "0s"; // lap button / open-ended
  }
  return null;
}

function formatStepTarget(raw: FitStepMsg): string | null {
  const targetType = normaliseEnum(raw.targetType);
  if (targetType === "open" || !targetType) return null;

  let low =
    numOrUndef(raw.customTargetValueLow) ?? numOrUndef(raw.customTargetLow);
  let high =
    numOrUndef(raw.customTargetValueHigh) ?? numOrUndef(raw.customTargetHigh);
  let value = numOrUndef(raw.targetValue);

  // FIT SDK power offset: values >= 1000 have +1000 offset
  if (targetType === "power") {
    if (low != null && low >= 1000) low -= 1000;
    if (high != null && high >= 1000) high -= 1000;
    if (value != null && value >= 1000) value -= 1000;
  }

  if (targetType === "power") {
    if (low != null && high != null && low !== high)
      return `${Math.round(low)}w-${Math.round(high)}w`;
    if (value != null && value > 0) return `${Math.round(value)}w`;
    if (low != null) return `${Math.round(low)}w`;
    return null;
  }

  if (targetType === "heartrate") {
    if (low != null && high != null && low !== high)
      return `${Math.round(low)}-${Math.round(high)} HR`;
    if (value != null && value > 0) return `${Math.round(value)} HR`;
    return null;
  }

  if (targetType === "cadence") {
    if (value != null && value > 0) return `${Math.round(value)}rpm`;
    if (low != null && high != null)
      return `${Math.round((low + high) / 2)}rpm`;
    return null;
  }

  return null;
}

function formatSingleStep(raw: FitStepMsg): string {
  const parts: string[] = [];

  const label =
    raw.wktStepName ||
    INTENSITY_LABELS[normaliseEnum(raw.intensity)] ||
    undefined;
  if (label) parts.push(label);

  const duration = formatStepDuration(raw);
  if (duration) parts.push(duration);

  const target = formatStepTarget(raw);
  if (target) parts.push(target);

  return `- ${parts.join(" ") || "lap button"}`;
}

function convertFitStepsToWorkoutText(messages: FitMessages): string | null {
  const stepMesgs = messages.workoutStepMesgs as FitStepMsg[] | undefined;
  if (!stepMesgs || stepMesgs.length === 0) return null;

  const sections: string[] = [];
  let i = 0;

  while (i < stepMesgs.length) {
    const raw = stepMesgs[i];
    const durType = normaliseEnum(raw.durationType);
    const repeatTimes = numOrUndef(raw.repeatTimes);
    const repeatSteps = numOrUndef(raw.repeatSteps);
    const durationStep = numOrUndef(raw.durationStep);

    // Format 1: repeatTimes + repeatSteps
    if (repeatTimes != null && repeatSteps != null && repeatSteps > 0) {
      const blockSteps = sections.splice(-repeatSteps);
      const header = `${repeatTimes}x`;
      sections.push(`${header}\n${blockSteps.join("\n")}`);
      i++;
      continue;
    }

    // Format 2: repeatUntilStepsCmplt
    if (
      durType === "repeatuntilstepscmplt" &&
      durationStep != null &&
      repeatSteps != null &&
      repeatSteps > 0
    ) {
      const startIdx = stepMesgs.findIndex(
        (s) => (numOrUndef(s.messageIndex) ?? 0) === durationStep
      );
      if (startIdx >= 0) {
        const count = i - startIdx;
        const blockSteps = sections.splice(-count);
        const header = `${repeatSteps}x`;
        sections.push(`${header}\n${blockSteps.join("\n")}`);
      }
      i++;
      continue;
    }

    sections.push(formatSingleStep(raw));
    i++;
  }

  const text = sections.join("\n\n");
  return text || null;
}

// --- Description builders ---

function buildWorkoutDescription(
  workout: WorkoutSummary,
  workoutText: string | null
): string {
  const parts: string[] = [];

  if (workoutText) {
    parts.push(workoutText);
  }

  if (workout.description?.trim()) {
    if (workoutText) {
      parts.push(`\n--- Coach Notes ---\n${workout.description.trim()}`);
    } else {
      parts.push(workout.description.trim());
    }
  }

  return parts.join("\n") || workout.title || "Migrated from TrainingPeaks";
}

function buildStrengthDescription(workout: StrengthWorkoutSummary): string {
  const parts: string[] = [];

  if (workout.instructions?.trim()) {
    parts.push(workout.instructions.trim());
  }

  if (workout.exercises.length > 0) {
    const exerciseLines = workout.exercises.map(
      (e) => `${e.sequenceOrder}. ${e.title}`
    );
    parts.push(`\nExercises:\n${exerciseLines.join("\n")}`);
  }

  const meta: string[] = [];
  if (workout.totalSets > 0) meta.push(`Sets: ${workout.totalSets}`);
  if (workout.totalBlocks > 0) meta.push(`Blocks: ${workout.totalBlocks}`);
  if (meta.length > 0) parts.push(`\n${meta.join(" | ")}`);

  return parts.join("\n") || workout.title;
}

// --- Intervals.icu activity upload (multipart FIT file) ---

async function uploadActivityFit(
  fitBuffer: Buffer,
  name: string,
  externalId: string,
  description: string | undefined,
  apiKey: string,
  athleteId: string,
  baseUrl: string
): Promise<{ id: number }> {
  const url = new URL(`/api/v1/athlete/${athleteId}/activities`, baseUrl);
  url.searchParams.set("name", name);
  url.searchParams.set("external_id", externalId);
  if (description) url.searchParams.set("description", description);

  const formData = new FormData();
  formData.append("file", new Blob([fitBuffer]), "activity.fit");

  const authHeader = `Basic ${btoa(`API_KEY:${apiKey}`)}`;
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: authHeader },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<{ id: number }>;
}

async function createManualActivity(
  data: {
    name: string;
    type: string;
    start_date_local: string;
    moving_time: number;
    elapsed_time: number;
    description?: string;
    external_id?: string;
  },
  apiKey: string,
  athleteId: string,
  baseUrl: string
): Promise<{ id: string }> {
  const url = `${baseUrl}/api/v1/athlete/${athleteId}/activities/manual`;
  const authHeader = `Basic ${btoa(`API_KEY:${apiKey}`)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Manual activity failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<{ id: string }>;
}

// --- Main ---

async function main() {
  const args = parseArgs();

  console.log(`\nTrainingPeaks → Intervals.icu Migration`);
  console.log(`Range: ${args.start} to ${args.end}`);
  if (args.dryRun) console.log("Mode: DRY RUN");
  if (args.noStructure) console.log("Structure: disabled");
  console.log("");

  const tp = new TrainingPeaksClient();
  const intervals = new IntervalsClient();

  // Read config for direct API calls (activity upload)
  const apiKey = process.env.INTERVALS_API_KEY!;
  const athleteId = process.env.INTERVALS_ATHLETE_ID || "0";
  const baseUrl = "https://intervals.icu";

  try {
    // 1. Fetch TP workouts
    console.log("Fetching TrainingPeaks workouts...");
    const tpWorkouts = await tp.getWorkouts(args.start, args.end);
    console.log(`  Found ${tpWorkouts.length} workouts`);

    // 2. Fetch TP strength workouts
    console.log("Fetching TrainingPeaks strength workouts...");
    let tpStrength: StrengthWorkoutSummary[] = [];
    try {
      tpStrength = await tp.getStrengthWorkouts(args.start, args.end);
      console.log(`  Found ${tpStrength.length} strength workouts`);
    } catch (err) {
      console.warn(`  ⚠ Could not fetch strength workouts: ${err}`);
    }

    // 3. Fetch existing Intervals.icu events + activities for duplicate detection
    console.log("Fetching existing Intervals.icu events...");
    const existingEvents = await intervals.getEvents(args.start, args.end);
    const existingIds = new Set(
      existingEvents
        .map((e) => e.external_id)
        .filter(
          (id): id is string => id != null && id.startsWith("tp-migrate-")
        )
    );

    console.log("Fetching existing Intervals.icu activities...");
    const existingActivities = await intervals.getActivities(
      args.start,
      args.end
    );

    // Build date indexes for duplicate detection
    const existingActivityDates = new Set<string>();
    const existingStrengthDates = new Set<string>();

    for (const e of existingEvents) {
      const date = e.start_date_local.slice(0, 10);
      if (e.type === "WeightTraining") {
        existingStrengthDates.add(date);
      } else if (e.type != null) {
        existingActivityDates.add(date);
      }
    }
    for (const a of existingActivities) {
      const date = a.start_date_local.slice(0, 10);
      if (a.type === "WeightTraining") {
        existingStrengthDates.add(date);
      } else if (a.type != null) {
        existingActivityDates.add(date);
      }
    }

    console.log(
      `  Found ${existingIds.size} previously migrated (by external_id)`
    );
    console.log(
      `  Found ${existingActivityDates.size} dates with existing activities/events`
    );
    console.log(
      `  Found ${existingStrengthDates.size} dates with existing strength events/activities`
    );

    // 4. Filter regular workouts — only those with recorded data (totalTime set)
    const skippedType: string[] = [];
    const skippedExisting: string[] = [];
    const skippedNoRecording: string[] = [];
    const toMigrate: WorkoutSummary[] = [];

    for (const w of tpWorkouts) {
      const extId = workoutExternalId(w.workoutId);
      if (existingIds.has(extId)) {
        skippedExisting.push(w.title || `#${w.workoutId}`);
        continue;
      }
      if (SKIP_TYPES.has(w.workoutType)) {
        skippedType.push(`${w.title || "#" + w.workoutId} (${w.workoutType})`);
        continue;
      }
      const sportType = mapSportType(w.workoutType);
      if (!sportType) continue;

      const date = w.workoutDay.slice(0, 10);
      if (existingActivityDates.has(date)) {
        skippedExisting.push(
          `${w.title || "#" + w.workoutId} (activity already on ${date})`
        );
        continue;
      }
      // Only migrate workouts that have a recorded activity (totalTime indicates completion)
      if (w.totalTime == null || w.totalTime === 0) {
        skippedNoRecording.push(
          `${w.title || "#" + w.workoutId} (${date}, no recorded data)`
        );
        continue;
      }
      toMigrate.push(w);
    }

    // 5. Filter strength workouts
    const strengthToMigrate: StrengthWorkoutSummary[] = [];
    for (const w of tpStrength) {
      const extId = strengthExternalId(w.workoutId);
      if (existingIds.has(extId)) {
        skippedExisting.push(w.title || `str-${w.workoutId}`);
      } else if (existingStrengthDates.has(w.workoutDay.slice(0, 10))) {
        skippedExisting.push(
          `${w.title || "str-" + w.workoutId} (strength already on date)`
        );
      } else {
        strengthToMigrate.push(w);
      }
    }

    // 6. Download activity FIT files from TP
    console.log(
      `\nDownloading activity FIT files for ${toMigrate.length} workouts...`
    );
    const activityFits = new Map<number, Buffer>();
    let fitDownloaded = 0;
    let fitMissing = 0;
    let fitFailed = 0;

    for (let idx = 0; idx < toMigrate.length; idx++) {
      const w = toMigrate[idx];
      if ((idx + 1) % 10 === 0 || idx === toMigrate.length - 1) {
        process.stdout.write(`  ${idx + 1}/${toMigrate.length}\r`);
      }
      try {
        const fitBuffer = await tp.downloadActivityFile(w.workoutId);
        if (fitBuffer) {
          activityFits.set(w.workoutId, fitBuffer);
          fitDownloaded++;
        } else {
          fitMissing++;
          skippedNoRecording.push(
            `${w.title || "#" + w.workoutId} (no FIT file available)`
          );
        }
      } catch {
        fitFailed++;
        skippedNoRecording.push(
          `${w.title || "#" + w.workoutId} (FIT download failed)`
        );
      }
    }
    console.log(
      `  Downloaded: ${fitDownloaded}, No file: ${fitMissing}, Failed: ${fitFailed}`
    );

    // Filter toMigrate to only those with FIT files
    const withFit = toMigrate.filter((w) => activityFits.has(w.workoutId));

    // 7. Download plan FIT files for structured workout text (optional)
    const workoutTexts = new Map<number, string | null>();
    if (!args.noStructure) {
      const structuredWorkouts = withFit.filter(
        (w) => w.tssPlanned != null || w.totalTimePlanned != null
      );
      if (structuredWorkouts.length > 0) {
        console.log(
          `\nDownloading plan files for ${structuredWorkouts.length} structured workouts...`
        );
        let converted = 0;
        let failed = 0;
        for (let idx = 0; idx < structuredWorkouts.length; idx++) {
          const w = structuredWorkouts[idx];
          if ((idx + 1) % 10 === 0 || idx === structuredWorkouts.length - 1) {
            process.stdout.write(`  ${idx + 1}/${structuredWorkouts.length}\r`);
          }
          try {
            const fitBuffer = await tp.downloadPlanFitFile(w.workoutId);
            if (fitBuffer) {
              const messages = await decodeFitBuffer(fitBuffer);
              const text = convertFitStepsToWorkoutText(messages);
              workoutTexts.set(w.workoutId, text);
              if (text) converted++;
            }
          } catch {
            failed++;
            workoutTexts.set(w.workoutId, null);
          }
        }
        console.log(
          `  Converted: ${converted}, No structure: ${structuredWorkouts.length - converted - failed}, Failed: ${failed}`
        );
      }
    }

    // 8. Summary
    console.log("\n--- Summary ---");
    console.log(`Total TP workouts:     ${tpWorkouts.length}`);
    console.log(`Total TP strength:     ${tpStrength.length}`);
    console.log(`Skipped (existing):    ${skippedExisting.length}`);
    console.log(`Skipped (type):        ${skippedType.length}`);
    console.log(`Skipped (no recording):${skippedNoRecording.length}`);
    if (skippedType.length > 0) {
      for (const s of skippedType) console.log(`  - ${s}`);
    }
    console.log(`Activities to upload:  ${withFit.length}`);
    console.log(`Strength to create:    ${strengthToMigrate.length}`);

    const sportCounts = new Map<string, number>();
    for (const w of withFit) {
      const sport = mapSportType(w.workoutType) ?? "Unknown";
      sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1);
    }
    for (const [sport, count] of sportCounts) {
      console.log(`  ${sport}: ${count}`);
    }

    if (args.dryRun) {
      console.log("\n--- Dry Run: Activities to upload ---");
      for (const w of withFit) {
        const date = w.workoutDay.slice(0, 10);
        const durStr =
          w.totalTime != null ? formatDuration(w.totalTime * 3600) : "?";
        const sport = mapSportType(w.workoutType) ?? "SKIP";
        const hasStructure = workoutTexts.get(w.workoutId) ? " [+plan]" : "";
        console.log(
          `  ${date} | ${sport.padEnd(15)} | ${(w.title || "Untitled").padEnd(40)} | ${durStr}${hasStructure}`
        );
      }
      for (const w of strengthToMigrate) {
        console.log(
          `  ${w.workoutDay.slice(0, 10)} | ${"WeightTraining".padEnd(15)} | ${w.title.padEnd(40)} | strength`
        );
      }
      if (skippedExisting.length > 0) {
        console.log("\n--- Skipped (already exists) ---");
        for (const s of skippedExisting) console.log(`  - ${s}`);
      }
      if (skippedNoRecording.length > 0) {
        console.log("\n--- Skipped (no recording) ---");
        for (const s of skippedNoRecording) console.log(`  - ${s}`);
      }
      console.log("\nDry run complete. Nothing uploaded.");
      return;
    }

    if (withFit.length === 0 && strengthToMigrate.length === 0) {
      console.log("\nNothing to migrate.");
      return;
    }

    // 9. Upload activity FIT files with description (includes workout text if available)
    let activitiesCreated = 0;
    let activitiesFailed = 0;

    if (withFit.length > 0) {
      console.log(`\nUploading ${withFit.length} activity FIT files...`);

      for (let idx = 0; idx < withFit.length; idx++) {
        const w = withFit[idx];
        const fitBuffer = activityFits.get(w.workoutId)!;
        const extId = workoutExternalId(w.workoutId);
        const name = w.title || "Untitled Workout";
        const workoutText = workoutTexts.get(w.workoutId) ?? null;
        const description =
          buildWorkoutDescription(w, workoutText) || undefined;

        try {
          await uploadActivityFit(
            fitBuffer,
            name,
            extId,
            description,
            apiKey,
            athleteId,
            baseUrl
          );
          activitiesCreated++;
          console.log(
            `  ${idx + 1}/${withFit.length} ✓ ${w.workoutDay.slice(0, 10)} ${name}`
          );
        } catch (err) {
          activitiesFailed++;
          console.error(
            `  ${idx + 1}/${withFit.length} ✗ ${w.workoutDay.slice(0, 10)} ${name}: ${err}`
          );
        }
      }
    }

    // 10. Create manual activities for strength workouts (so they appear as completed)
    let strengthActivitiesCreated = 0;
    let strengthActivitiesFailed = 0;

    if (strengthToMigrate.length > 0) {
      console.log(
        `\nCreating ${strengthToMigrate.length} manual strength activities...`
      );

      for (let idx = 0; idx < strengthToMigrate.length; idx++) {
        const w = strengthToMigrate[idx];
        // TP strength totalTime is in hours — convert to seconds
        const movingTime =
          w.totalTime != null ? Math.round(w.totalTime * 3600) : 3600;
        const startDate = w.workoutDay.includes("T")
          ? w.workoutDay
          : `${w.workoutDay}T00:00:00`;

        try {
          await createManualActivity(
            {
              name: w.title || "Strength Session",
              type: "WeightTraining",
              start_date_local: startDate,
              moving_time: movingTime,
              elapsed_time: movingTime,
              description: buildStrengthDescription(w),
              external_id: strengthExternalId(w.workoutId),
            },
            apiKey,
            athleteId,
            baseUrl
          );
          strengthActivitiesCreated++;
          console.log(
            `  ${idx + 1}/${strengthToMigrate.length} ✓ ${w.workoutDay.slice(0, 10)} ${w.title}`
          );
        } catch (err) {
          strengthActivitiesFailed++;
          console.error(
            `  ${idx + 1}/${strengthToMigrate.length} ✗ ${w.workoutDay.slice(0, 10)} ${w.title}: ${err}`
          );
        }
      }
    }

    console.log(`\n--- Results ---`);
    console.log(`Activities uploaded:       ${activitiesCreated}`);
    console.log(`Strength activities:       ${strengthActivitiesCreated}`);
    if (activitiesFailed > 0)
      console.log(`Activities failed:        ${activitiesFailed}`);
    if (strengthActivitiesFailed > 0)
      console.log(`Strength failed:          ${strengthActivitiesFailed}`);
  } finally {
    await tp.close();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
