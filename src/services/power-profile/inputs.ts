import type { IActivitiesApi } from "../activities/index.js";
import type { IAthleteApi, SportSetting } from "../athlete/index.js";
import type { IPowerCurvesApi } from "../power-curves/index.js";
import { deriveLatestMap } from "../map/index.js";
import type {
  InputField,
  InputSource,
  PowerProfileOverrides,
  ResolvedInputs,
  Sex,
} from "./types.js";

export interface PowerProfileDeps {
  athleteApi: IAthleteApi;
  activitiesApi: IActivitiesApi;
  powerCurvesApi: IPowerCurvesApi;
}

export interface ResolveOptions {
  today?: string;
}

const field = <T>(
  value: T | null,
  source: InputSource,
  note?: string
): InputField<T> => ({ value, source, ...(note ? { note } : {}) });

const missing = <T>(): InputField<T> => ({ value: null, source: "missing" });

export async function resolveInputs(
  deps: PowerProfileDeps,
  overrides: PowerProfileOverrides = {},
  opts: ResolveOptions = {}
): Promise<ResolvedInputs> {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const warnings: string[] = [];

  const [athleteRaw, mapDerivation] = await Promise.all([
    deps.athleteApi.getAthlete().catch(() => null),
    overrides.mapWatts != null
      ? Promise.resolve(null)
      : deriveLatestMap(deps.activitiesApi, today),
  ]);

  const athlete = athleteRaw as Record<string, unknown> | null;

  // weight
  let weightKg: InputField<number>;
  if (overrides.weightKg != null) {
    weightKg = field(overrides.weightKg, "override");
  } else {
    const w = pickNumber(athlete, ["icu_weight", "weight"]);
    weightKg = w != null ? field(w, "athlete") : missing<number>();
  }

  // ftp — top-level icu_ftp/ftp, or first cycling sportSettings entry
  let ftpWatts: InputField<number>;
  if (overrides.ftpWatts != null) {
    ftpWatts = field(overrides.ftpWatts, "override");
  } else {
    const top = pickNumber(athlete, ["icu_ftp", "ftp"]);
    const cycling = pickCyclingSport(athlete);
    const cy = cycling ? pickNumber(cycling, ["ftp"]) : null;
    const v = top ?? cy ?? null;
    ftpWatts = v != null ? field(v, "athlete") : missing<number>();
  }

  // sex (M/F → male/female)
  let sex: InputField<Sex>;
  if (overrides.sex) {
    sex = field(overrides.sex, "override");
  } else {
    const raw = pickString(athlete, "sex");
    const mapped =
      raw === "M" || raw === "male"
        ? "male"
        : raw === "F" || raw === "female"
          ? "female"
          : null;
    sex = mapped ? field<Sex>(mapped, "athlete") : missing<Sex>();
  }

  // age from icu_date_of_birth / date_of_birth / birthday
  let age: InputField<number>;
  if (overrides.age != null) {
    age = field(overrides.age, "override");
  } else {
    const dob =
      pickString(athlete, "icu_date_of_birth") ??
      pickString(athlete, "date_of_birth") ??
      pickString(athlete, "birthday");
    const computed = dob ? computeAgeFromDob(dob, today) : null;
    age = computed != null ? field(computed, "derived") : missing<number>();
  }

  // height — Intervals.icu stores top-level `height` in METRES
  let heightCm: InputField<number>;
  if (overrides.heightCm != null) {
    heightCm = field(overrides.heightCm, "override");
  } else {
    const h = pickNumber(athlete, ["height"]);
    if (h != null && h > 0) {
      const cm = h <= 3 ? h * 100 : h; // metres → cm if value looks like metres
      heightCm = field(cm, "athlete");
    } else {
      heightCm = missing<number>();
    }
  }

  // power curve peaks (5/60/300s)
  let p5s: InputField<number> = missing<number>();
  let p60: InputField<number> = missing<number>();
  let p5min: InputField<number> = missing<number>();

  if (overrides.p5s != null) p5s = field(overrides.p5s, "override");
  if (overrides.p60 != null) p60 = field(overrides.p60, "override");
  if (overrides.p5min != null) p5min = field(overrides.p5min, "override");

  const needCurve =
    overrides.p5s == null || overrides.p60 == null || overrides.p5min == null;
  if (needCurve) {
    try {
      const curveRaw = await deps.powerCurvesApi.getPowerCurve({
        range: overrides.powerCurveRange ?? "90d",
        type: "Ride",
      });
      const peaks = extractPeaks(curveRaw);
      if (overrides.p5s == null && peaks.p5s != null)
        p5s = field(peaks.p5s, "powerCurve");
      if (overrides.p60 == null && peaks.p60 != null)
        p60 = field(peaks.p60, "powerCurve");
      if (overrides.p5min == null && peaks.p5min != null)
        p5min = field(peaks.p5min, "powerCurve");
    } catch {
      warnings.push(
        "Could not load power curve; p5s/p60/p5min unavailable unless provided."
      );
    }
  }

  // map
  let mapWatts: InputField<number>;
  if (overrides.mapWatts != null) {
    mapWatts = field(overrides.mapWatts, "override");
  } else if (mapDerivation?.map) {
    mapWatts = field(
      mapDerivation.map.watts,
      "mapDerivation",
      `from activity "${mapDerivation.map.computedFrom.activityName}" on ${mapDerivation.map.computedFrom.activityDate}`
    );
  } else {
    mapWatts = missing<number>();
    if (mapDerivation?.mapWarning) warnings.push(mapDerivation.mapWarning);
  }

  // masters — auto from age >= 40, override wins
  let masters: InputField<boolean>;
  if (overrides.masters != null) {
    masters = field(overrides.masters, "override");
  } else if (age.value != null && age.value >= 40) {
    masters = field(true, "derived");
  } else if (age.value != null) {
    masters = field(false, "derived");
  } else {
    masters = missing<boolean>();
  }

  return {
    mapWatts,
    weightKg,
    ftpWatts,
    sex,
    age,
    heightCm,
    p5s,
    p60,
    p5min,
    aeroPosition:
      overrides.aeroPosition != null
        ? field(overrides.aeroPosition, "override")
        : missing<ResolvedInputs["aeroPosition"]["value"] & string>(),
    cdaKnown:
      overrides.cdaKnown != null
        ? field(overrides.cdaKnown, "override")
        : missing<number>(),
    discipline:
      overrides.discipline != null
        ? field(overrides.discipline, "override")
        : missing<ResolvedInputs["discipline"]["value"] & string>(),
    history:
      overrides.history != null
        ? field(overrides.history, "override")
        : missing<ResolvedInputs["history"]["value"] & string>(),
    strength:
      overrides.strength != null
        ? field(overrides.strength, "override")
        : missing<ResolvedInputs["strength"]["value"] & string>(),
    weeklyHours:
      overrides.weeklyHours != null
        ? field(overrides.weeklyHours, "override")
        : missing<number>(),
    masters,
    warnings,
  };
}

function pickNumber(
  obj: Record<string, unknown> | null,
  keys: string[]
): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

function pickString(
  obj: Record<string, unknown> | null,
  key: string
): string | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function pickCyclingSport(
  athlete: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!athlete) return null;
  const settings = (athlete["sportSettings"] ?? athlete["sport_settings"]) as
    | SportSetting[]
    | undefined;
  if (!Array.isArray(settings)) return null;
  const cycling = settings.find((s) =>
    (s.types ?? []).some((t) => /ride|cycl|bike/i.test(t))
  );
  return (cycling ?? settings[0]) as unknown as Record<string, unknown> | null;
}

function computeAgeFromDob(dob: string, today: string): number | null {
  const d = Date.parse(dob);
  const t = Date.parse(today);
  if (Number.isNaN(d) || Number.isNaN(t)) return null;
  const dobDate = new Date(d);
  const todayDate = new Date(t);
  let years = todayDate.getUTCFullYear() - dobDate.getUTCFullYear();
  const m = todayDate.getUTCMonth() - dobDate.getUTCMonth();
  if (m < 0 || (m === 0 && todayDate.getUTCDate() < dobDate.getUTCDate())) {
    years--;
  }
  return years >= 0 && years < 130 ? years : null;
}

interface PeakSet {
  p5s: number | null;
  p60: number | null;
  p5min: number | null;
}

// Intervals.icu power-curves-ext response is either an array of points
// `[{ secs, value, activity_id }, ...]` or an envelope `{ list: [{ secs:[],
// watts:[], values:[], ... }] }`. Handle both shapes defensively.
export function extractPeaks(raw: unknown): PeakSet {
  const out: PeakSet = { p5s: null, p60: null, p5min: null };
  if (!raw) return out;

  if (Array.isArray(raw)) {
    for (const p of raw as Array<Record<string, unknown>>) {
      const secs = typeof p.secs === "number" ? p.secs : null;
      const value =
        typeof p.value === "number"
          ? p.value
          : typeof p.watts === "number"
            ? (p.watts as number)
            : null;
      if (secs == null || value == null) continue;
      if (secs === 5) out.p5s = value;
      else if (secs === 60) out.p60 = value;
      else if (secs === 300) out.p5min = value;
    }
    return out;
  }

  const obj = raw as Record<string, unknown>;
  const list = obj.list ?? obj.points;
  if (Array.isArray(list) && list.length) {
    const first = list[0] as Record<string, unknown>;
    const secs = first.secs as number[] | undefined;
    const watts = (first.watts ?? first.values) as number[] | undefined;
    if (Array.isArray(secs) && Array.isArray(watts)) {
      for (let i = 0; i < secs.length; i++) {
        if (secs[i] === 5) out.p5s = watts[i] ?? out.p5s;
        else if (secs[i] === 60) out.p60 = watts[i] ?? out.p60;
        else if (secs[i] === 300) out.p5min = watts[i] ?? out.p5min;
      }
    }
  }
  return out;
}
