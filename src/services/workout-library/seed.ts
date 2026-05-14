import type { WorkoutStep, RepeatBlock } from "../workout-builder/types.js";
import type { IWorkoutBuilder } from "../workout-builder/index.js";
import type { IWorkoutLibraryApi } from "./api.js";
import type {
  LibraryFolder,
  LibraryNode,
  LibraryWorkoutSummary,
  Rationale,
  RationaleBasis,
  RationaleIntensity,
} from "./types.js";
import { isFolderNode } from "./types.js";
import { embedRationale } from "./parser.js";

export type Pct = number | [number, number];

export interface SeedIntensity {
  basis: RationaleBasis;
  pct: Pct;
}

export interface SeedStep {
  label?: string;
  duration: string;
  intensity: SeedIntensity;
  cadence?: string;
  ramp?: boolean;
}

export interface SeedRepeat {
  iterations: number;
  label?: string;
  steps: SeedStep[];
}

// Intervals.icu's folder API ignores the `parent` field on create — folders are
// effectively flat. We use a "Coach: <category>" prefix scheme so seed folders
// don't collide with the user's own folders and are visually grouped.
export interface SeedTemplate {
  seedId: string;
  name: string;
  folder: string; // e.g. "Coach: VO2 Max"
  description: string; // free-form rationale visible above the steps
  type?: string;
  steps: Array<SeedStep | SeedRepeat>;
}

export interface SeedAnchors {
  mapWatts?: number;
  ftpWatts?: number;
}

export interface SeedOptions extends SeedAnchors {
  dryRun?: boolean;
}

export interface SeedAction {
  seedId: string;
  name: string;
  folder: string;
  basis: RationaleBasis;
  anchorWatts: number;
  description: string;
  workoutId?: number;
}

export interface SeedReport {
  created: SeedAction[];
  skipped: Array<{ seedId: string; name: string; reason: string }>;
  warnings: string[];
  dryRun: boolean;
}

export const CANONICAL_TEMPLATES: SeedTemplate[] = [
  {
    seedId: "ftp-20min-test",
    name: "FTP 20-min test",
    folder: "Coach: Tests",
    description:
      "20-minute FTP estimation test. Use FTP = 95% of best 20-min average. " +
      "Pace target = bury yourself starting at minute 17. Standardise warm-up so retests are comparable.",
    steps: [
      { label: "Warm-up", duration: "15m", intensity: ftp([55, 65]) },
      { duration: "1m", intensity: ftp(100) },
      { duration: "1m", intensity: ftp(60) },
      { duration: "1m", intensity: ftp(110) },
      { duration: "1m", intensity: ftp(60) },
      { duration: "1m", intensity: ftp(120) },
      { duration: "5m", intensity: ftp(60) },
      { label: "20min effort", duration: "20m", intensity: ftp([95, 105]) },
      { label: "Cooldown", duration: "10m", intensity: ftp(50) },
    ],
  },
  {
    seedId: "map-ramp-test",
    name: "MAP ramp test",
    folder: "Coach: Tests",
    description:
      "Ramp test to exhaustion. MAP = highest 1-minute power achieved. " +
      "Continue until you cannot hold the target wattage; the watts shown are guidance, " +
      "the test is open-ended. Standardise warm-up across retests. " +
      "Test every 6–8 weeks or at mesocycle starts.",
    type: "Ride",
    steps: [
      { label: "Warm-up", duration: "5m", intensity: map(40) },
      { label: "Ramp", duration: "20m", intensity: map([40, 110]), ramp: true },
      { label: "Cooldown", duration: "5m", intensity: map(35) },
    ],
  },
  {
    seedId: "vo2-4x4",
    name: "VO2 4×4",
    folder: "Coach: VO2 Max",
    description:
      "Classic VO₂max session. 4-minute hard with equal recovery elicits the highest fraction of time at VO₂max " +
      "for a given session length (Seiler et al., 2013). Aim to hold final rep ≥ first rep power.",
    steps: [
      { label: "Warm-up", duration: "15m", intensity: map([50, 60]) },
      {
        iterations: 4,
        steps: [
          { label: "On", duration: "4m", intensity: map([95, 102]) },
          { label: "Off", duration: "4m", intensity: map(50) },
        ],
      },
      { label: "Cooldown", duration: "10m", intensity: map(45) },
    ],
  },
  {
    seedId: "vo2-30-30",
    name: "VO2 30/30s",
    folder: "Coach: VO2 Max",
    description:
      "Microintervals: 30s on / 30s off keeps cumulative time at high aerobic strain " +
      "while limiting peripheral fatigue per rep. Useful when 4×4 has been overdone or " +
      "when targeting repeatability rather than peak elicitation.",
    steps: [
      { label: "Warm-up", duration: "15m", intensity: map([50, 60]) },
      {
        iterations: 16,
        steps: [
          { label: "On", duration: "30s", intensity: map(110) },
          { label: "Off", duration: "30s", intensity: map(50) },
        ],
      },
      { label: "Cooldown", duration: "10m", intensity: map(45) },
    ],
  },
  {
    seedId: "vo2-preloaded-shorts",
    name: "VO2 preloaded shorts",
    folder: "Coach: VO2 Max",
    description:
      "Each series opens with a ~2-min 'preload' interval to drive VO2 upward fast, then " +
      "a short 30s recovery preserves the elevated state, so the short 30/15s reps that " +
      "follow start already near 90% VO2peak instead of climbing into it. Net effect: more " +
      "time at high fraction of VO2max per session than plain 30/30s. Use when 30/30s have " +
      "been well tolerated and you want to extract more aerobic stimulus per session; " +
      "don't use as the first VO2 session of a block. Sources: Odden et al. 2024 " +
      "(HIT time-at-fraction-of-VO2max); Vaccari et al. 2020 (VO2 kinetics, short vs long).",
    steps: [
      { label: "Warm-up", duration: "15m", intensity: map([50, 60]) },
      {
        iterations: 3,
        label: "Series",
        steps: [
          {
            label: "Preload",
            duration: "2m",
            intensity: map([95, 100]),
            cadence: "95rpm",
          },
          { label: "Short rec", duration: "30s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Off", duration: "15s", intensity: map(50) },
          { label: "On", duration: "30s", intensity: map([100, 105]) },
          { label: "Series rec", duration: "3m", intensity: map(50) },
        ],
      },
      { label: "Cooldown", duration: "10m", intensity: map(45) },
    ],
  },
  {
    seedId: "threshold-2x20",
    name: "Threshold 2×20",
    folder: "Coach: Threshold",
    description:
      "Bread-and-butter threshold session. Target NP within range, even pacing across reps. " +
      "If second rep average drops >5W from first, start, the day was too fatigued for it.",
    steps: [
      { label: "Warm-up", duration: "15m", intensity: ftp([55, 70]) },
      {
        iterations: 2,
        steps: [
          { label: "Threshold", duration: "20m", intensity: ftp([95, 105]) },
          { label: "Recovery", duration: "5m", intensity: ftp(55) },
        ],
      },
      { label: "Cooldown", duration: "10m", intensity: ftp(50) },
    ],
  },
  {
    seedId: "sweet-spot-3x12",
    name: "Sweet Spot 3×12",
    folder: "Coach: Sweet Spot",
    description:
      "Sub-threshold steady work. Lower fatigue cost than threshold, allowing higher weekly volume " +
      "of sustained efforts during build phases. Hold cadence ≥ 85.",
    steps: [
      { label: "Warm-up", duration: "12m", intensity: ftp([55, 70]) },
      {
        iterations: 3,
        steps: [
          { label: "SST", duration: "12m", intensity: ftp([88, 94]) },
          { label: "Recovery", duration: "4m", intensity: ftp(55) },
        ],
      },
      { label: "Cooldown", duration: "10m", intensity: ftp(50) },
    ],
  },
  {
    seedId: "z2-endurance-2h",
    name: "Z2 endurance 2h",
    folder: "Coach: Endurance",
    description:
      "Aerobic durability work. Cap NP ≤ 68% MAP. Short excursions above range are fine if NP " +
      "stays capped. If terrain or fatigue drives NP above the cap, this no longer counts as Z2.",
    steps: [{ label: "Z2", duration: "2h", intensity: map([50, 65]) }],
  },
  {
    seedId: "miet-60",
    name: "MIET 60min",
    folder: "Coach: Endurance",
    description:
      "Moderately intensive endurance — masters-friendly aerobic load. Useful when Z2 volume " +
      "is constrained by life and you want more aerobic stimulus per hour without entering fatigue territory.",
    steps: [
      { label: "Warm-up", duration: "10m", intensity: map(55) },
      { label: "MIET", duration: "45m", intensity: map([60, 70]) },
      { label: "Cooldown", duration: "5m", intensity: map(45) },
    ],
  },
  {
    seedId: "recovery-spin",
    name: "Recovery spin",
    folder: "Coach: Recovery",
    description:
      "Active recovery. Easy spin, high cadence, very low load. " +
      "Goal: circulation, not training stimulus. Keep it short if fatigue is high.",
    steps: [
      {
        label: "Easy",
        duration: "30m",
        intensity: map([30, 40]),
        cadence: "95rpm",
      },
    ],
  },
];

function ftp(pct: Pct): SeedIntensity {
  return { basis: "FTP", pct };
}

function map(pct: Pct): SeedIntensity {
  return { basis: "MAP", pct };
}

function resolveAnchor(
  basis: RationaleBasis,
  anchors: SeedAnchors
): number | null {
  if (basis === "MAP") return anchors.mapWatts ?? null;
  if (basis === "FTP") return anchors.ftpWatts ?? null;
  return null;
}

function computeWatts(intensity: SeedIntensity, anchorWatts: number): string {
  const { pct } = intensity;
  if (Array.isArray(pct)) {
    const lo = Math.round((pct[0] / 100) * anchorWatts);
    const hi = Math.round((pct[1] / 100) * anchorWatts);
    return `${lo}w-${hi}w`;
  }
  return `${Math.round((pct / 100) * anchorWatts)}w`;
}

function toBuilderStep(step: SeedStep, anchorWatts: number): WorkoutStep {
  return {
    ...(step.label ? { label: step.label } : {}),
    duration: step.duration,
    target: computeWatts(step.intensity, anchorWatts),
    ...(step.cadence ? { cadence: step.cadence } : {}),
    ...(step.ramp ? { ramp: true } : {}),
  };
}

function flattenIntensities(template: SeedTemplate): RationaleIntensity[] {
  const out: RationaleIntensity[] = [];
  for (const node of template.steps) {
    if ("iterations" in node) {
      for (const s of node.steps) {
        out.push({
          stepRef: s.label ?? s.duration,
          pct: s.intensity.pct,
        });
      }
    } else {
      out.push({
        stepRef: node.label ?? node.duration,
        pct: node.intensity.pct,
      });
    }
  }
  return out;
}

interface MaterializedTemplate {
  template: SeedTemplate;
  basis: RationaleBasis;
  anchorWatts: number;
  body: string;
  rationale: Rationale;
  description: string;
}

export function materializeTemplate(
  template: SeedTemplate,
  anchors: SeedAnchors,
  builder: IWorkoutBuilder
): MaterializedTemplate | { skip: string } {
  const basisCounts = countBases(template);
  if (basisCounts.MAP > 0 && basisCounts.FTP > 0) {
    throw new Error(
      `Template ${template.seedId} mixes MAP and FTP intensities — pick one basis per template`
    );
  }
  const basis: RationaleBasis = basisCounts.MAP > 0 ? "MAP" : "FTP";
  const anchorWatts = resolveAnchor(basis, anchors);
  if (anchorWatts === null) {
    return {
      skip: `Missing ${basis === "MAP" ? "mapWatts" : "ftpWatts"} for ${template.name}`,
    };
  }

  const builderSteps: Array<WorkoutStep | RepeatBlock> = template.steps.map(
    (node) => {
      if ("iterations" in node) {
        return {
          iterations: node.iterations,
          ...(node.label ? { label: node.label } : {}),
          steps: node.steps.map((s) => toBuilderStep(s, anchorWatts)),
        };
      }
      return toBuilderStep(node, anchorWatts);
    }
  );

  const body = builder.toDescription(builderSteps);
  const rationale: Rationale = {
    basis,
    anchorWatts,
    seedId: template.seedId,
    intensities: flattenIntensities(template),
  };
  const description = embedRationale(
    `${template.description}\n\n${body}`,
    rationale
  );

  return { template, basis, anchorWatts, body, rationale, description };
}

function countBases(template: SeedTemplate): Record<RationaleBasis, number> {
  const counts: Record<RationaleBasis, number> = { MAP: 0, FTP: 0 };
  for (const node of template.steps) {
    if ("iterations" in node) {
      for (const s of node.steps) counts[s.intensity.basis]++;
    } else {
      counts[node.intensity.basis]++;
    }
  }
  return counts;
}

export interface FolderIndex {
  byName: Map<string, LibraryFolder>;
  workoutNamesByFolderId: Map<number, Set<string>>;
}

export function indexFolders(folders: LibraryFolder[]): FolderIndex {
  const byName = new Map<string, LibraryFolder>();
  const workoutNamesByFolderId = new Map<number, Set<string>>();

  function walk(node: LibraryNode): void {
    if (isFolderNode(node)) {
      // Folder API is flat in practice; first match wins for a given name.
      if (!byName.has(node.name)) byName.set(node.name, node);
      const names = new Set<string>();
      for (const child of node.children ?? []) {
        if (!isFolderNode(child)) {
          names.add((child as LibraryWorkoutSummary).name);
        } else {
          walk(child);
        }
      }
      workoutNamesByFolderId.set(node.id, names);
    }
  }
  for (const f of folders) walk(f);
  return { byName, workoutNamesByFolderId };
}

export async function ensureFolder(
  api: IWorkoutLibraryApi,
  index: FolderIndex,
  name: string
): Promise<LibraryFolder> {
  const existing = index.byName.get(name);
  if (existing) return existing;
  const created = await api.createFolder(name, null);
  index.byName.set(name, created);
  index.workoutNamesByFolderId.set(created.id, new Set());
  return created;
}

export async function runSeed(
  api: IWorkoutLibraryApi,
  builder: IWorkoutBuilder,
  opts: SeedOptions = {}
): Promise<SeedReport> {
  const { dryRun = false } = opts;
  const folders = await api.listFolders();
  const index = indexFolders(folders);

  const report: SeedReport = {
    created: [],
    skipped: [],
    warnings: [],
    dryRun,
  };

  for (const template of CANONICAL_TEMPLATES) {
    const materialized = materializeTemplate(template, opts, builder);
    if ("skip" in materialized) {
      report.warnings.push(materialized.skip);
      report.skipped.push({
        seedId: template.seedId,
        name: template.name,
        reason: materialized.skip,
      });
      continue;
    }

    let folder: LibraryFolder | null = null;
    if (!dryRun) {
      folder = await ensureFolder(api, index, template.folder);
    } else {
      folder = index.byName.get(template.folder) ?? null;
    }

    const existingNames = folder
      ? (index.workoutNamesByFolderId.get(folder.id) ?? new Set<string>())
      : new Set<string>();
    if (existingNames.has(template.name)) {
      report.skipped.push({
        seedId: template.seedId,
        name: template.name,
        reason: "Workout with this name already exists in folder",
      });
      continue;
    }

    const action: SeedAction = {
      seedId: template.seedId,
      name: template.name,
      folder: template.folder,
      basis: materialized.basis,
      anchorWatts: materialized.anchorWatts,
      description: materialized.description,
    };

    if (!dryRun && folder) {
      const created = await api.createWorkout({
        name: template.name,
        description: materialized.description,
        folder_id: folder.id,
        type: template.type ?? "Ride",
      });
      action.workoutId = created.id;
      existingNames.add(template.name);
    }

    report.created.push(action);
  }

  if (!opts.mapWatts) {
    report.warnings.unshift(
      "mapWatts not provided — MAP-anchored templates were skipped. Supply mapWatts to seed VO2/Z2/MIET/recovery."
    );
  }
  if (!opts.ftpWatts) {
    report.warnings.unshift(
      "ftpWatts not provided — FTP-anchored templates were skipped. Supply ftpWatts to seed FTP test/threshold/sweet spot."
    );
  }

  return report;
}
