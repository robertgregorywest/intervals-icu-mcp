import type { IAthleteApi, Zone, SportSetting } from "../athlete/index.js";
import type { IWellnessApi, WellnessRecord } from "../wellness/index.js";
import type {
  AthleteSnapshot,
  CoachingContext,
  FitnessSnapshot,
  WellnessTrendPoint,
} from "./types.js";

export interface CoachingContextDeps {
  athleteApi: IAthleteApi;
  wellnessApi: IWellnessApi;
}

export interface CoachingContextOptions {
  days?: number;
  today?: string;
}

export const DEFAULT_DAYS = 7;
export const MAX_DAYS = 30;

export async function buildCoachingContext(
  deps: CoachingContextDeps,
  opts: CoachingContextOptions = {}
): Promise<CoachingContext> {
  const days = clampDays(opts.days);
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const oldest = addDays(today, -(days - 1));

  const [athleteRaw, wellnessRaw] = await Promise.all([
    deps.athleteApi.getAthlete(),
    deps.wellnessApi.getWellness(oldest, today),
  ]);

  const athlete = summarizeAthlete(
    athleteRaw as Record<string, unknown> & {
      sport_settings?: SportSetting[];
      sportSettings?: SportSetting[];
    }
  );
  const trend = summarizeTrend(wellnessRaw);
  const fitness = pickFitnessSnapshot(trend);

  return {
    asOf: today,
    daysWindow: days,
    athlete,
    fitness,
    wellnessTrend: trend,
  };
}

function clampDays(input?: number): number {
  if (input == null) return DEFAULT_DAYS;
  if (!Number.isFinite(input) || input < 1) {
    throw new Error(`days must be >= 1, got ${input}`);
  }
  if (input > MAX_DAYS) {
    throw new Error(`days must be <= ${MAX_DAYS}, got ${input}`);
  }
  return Math.floor(input);
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function summarizeAthlete(
  raw: Record<string, unknown> & {
    sport_settings?: SportSetting[];
    sportSettings?: SportSetting[];
  }
): AthleteSnapshot {
  const sportSettings = raw.sport_settings ?? raw.sportSettings ?? [];
  const cycling = pickCyclingSport(sportSettings);
  return {
    id: pickString(raw, "id"),
    name: pickString(raw, "name"),
    weight: pickNumber(raw, ["weight", "icu_weight"]),
    ftp: pickNumber(raw, ["ftp", "icu_ftp"]) ?? cycling?.ftp ?? null,
    lthr: pickNumber(raw, ["lthr", "icu_lthr"]) ?? cycling?.lthr ?? null,
    max_hr:
      pickNumber(raw, ["max_hr", "icu_max_hr"]) ?? cycling?.max_hr ?? null,
    resting_hr: pickNumber(raw, ["resting_hr", "icu_resting_hr"]),
    power_zones: pickZones(cycling?.power_zones),
    hr_zones: pickZones(cycling?.hr_zones),
    pace_zones: pickZones(cycling?.pace_zones),
    sport_settings_count: sportSettings.length,
  };
}

function pickCyclingSport(settings: SportSetting[]): SportSetting | undefined {
  if (!settings.length) return undefined;
  const cycling = settings.find((s) =>
    (s.types ?? []).some((t) => /ride|cycl|bike/i.test(t))
  );
  return cycling ?? settings[0];
}

function pickZones(zones: Zone[] | undefined): Zone[] | null {
  if (!zones || !zones.length) return null;
  return zones;
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function pickNumber(
  obj: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function summarizeTrend(records: WellnessRecord[]): WellnessTrendPoint[] {
  return [...records]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((r) => {
      const ctl = numeric(r.ctl);
      const atl = numeric(r.atl);
      return {
        date: String(r.id),
        ctl: round1(ctl),
        atl: round1(atl),
        tsb: round1(ctl - atl),
        fatigue: r.fatigue,
        soreness: r.soreness,
        motivation: r.motivation,
        mood: r.mood,
        stress: r.stress,
        readiness: r.readiness,
        sleep_secs: r.sleepSecs,
        sleep_score: r.sleepScore,
        resting_hr: r.restingHR,
        hrv: r.hrv,
      };
    });
}

function pickFitnessSnapshot(trend: WellnessTrendPoint[]): FitnessSnapshot {
  if (!trend.length) {
    return {
      date: null,
      ctl: null,
      atl: null,
      tsb: null,
      ramp_rate: null,
    };
  }
  const last = trend[trend.length - 1];
  const first = trend[0];
  const rampRate =
    trend.length > 1 ? round1((last.ctl - first.ctl) / trend.length) : 0;
  return {
    date: last.date,
    ctl: last.ctl,
    atl: last.atl,
    tsb: last.tsb,
    ramp_rate: rampRate,
  };
}

function numeric(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
