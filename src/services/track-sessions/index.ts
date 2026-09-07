import { compareRuns, resolveRunRef, TrackComparisonError } from "./compare.js";
import { deriveRun, developmentFromBasis, startFor } from "./derive.js";
import { loadTrackSessionRecords, recordsDir } from "./loader.js";
import { RATE_DP, round } from "./round.js";
import type {
  CompareTrackSessionsOptions,
  GetTrackSessionOptions,
  ListTrackSessionsResult,
  RunComparison,
  TrackSessionDetail,
  TrackSessionRecord,
} from "./types.js";

export interface TrackSessionsDeps {
  /** Overridden in tests; production reads the records directory. */
  load?: () => {
    directory: string;
    records: TrackSessionRecord[];
    notes: string[];
  };
}

export interface ITrackSessions {
  listTrackSessions(): Promise<ListTrackSessionsResult>;
  getTrackSession(options: GetTrackSessionOptions): Promise<TrackSessionDetail>;
  compareTrackSessions(
    options: CompareTrackSessionsOptions
  ): Promise<RunComparison>;
}

/**
 * Reads timed lap splits from tracked record files and derives the model-free
 * quantities a pursuit is judged on.
 *
 * The only service in the client that touches no Intervals.icu endpoint — it
 * takes no `IHttpClient` and needs no API key. Power for these laps comes from
 * `compute_track_lap_power`, which owns the join to the SRM.
 */
export class TrackSessions implements ITrackSessions {
  private load: () => {
    directory: string;
    records: TrackSessionRecord[];
    notes: string[];
  };

  constructor(deps: TrackSessionsDeps = {}) {
    this.load = deps.load ?? (() => loadTrackSessionRecords());
  }

  async listTrackSessions(): Promise<ListTrackSessionsResult> {
    const { directory, records, notes } = this.load();
    return {
      directory,
      sessions: records.map((r) => ({
        id: r.basis.id,
        date: r.basis.date,
        kind: r.basis.kind,
        event: r.basis.event,
        venue: r.basis.venue,
        activityId: r.basis.activityId,
        runs: r.runs.map((run) => ({
          ref: `${r.basis.id}#${run.run}`,
          run: run.run,
          start: startFor(r.basis, run.run),
          laps: run.laps.length,
          distanceMeters: run.distanceMeters,
          durationSeconds: run.durationSeconds,
        })),
      })),
      notes: notes.length ? notes : undefined,
    };
  }

  async getTrackSession(
    options: GetTrackSessionOptions
  ): Promise<TrackSessionDetail> {
    const { records } = this.load();
    const record = records.find((r) => r.basis.id === options.id);
    if (!record) {
      const available = records.map((r) => r.basis.id).join(", ");
      throw new TrackComparisonError(
        `No track session record with id "${options.id}".` +
          (available
            ? ` Available: ${available}.`
            : ` No records found in ${recordsDir()}.`)
      );
    }

    const development = developmentFromBasis(record.basis);
    const notes: string[] = [];
    if (!development) {
      notes.push(
        "No gear or development in the record's frontmatter, so cadence is not derived. " +
          "Add `gear: 64x16` (and `rolloutMm` if it is not 2099) or `developmentMeters`."
      );
    }

    return {
      basis: record.basis,
      developmentMeters: round(development?.meters, RATE_DP),
      developmentSource: development?.source,
      prose: record.prose,
      runs: record.runs.map((run) =>
        deriveRun(record.basis, run, development?.meters, options.segmentLaps)
      ),
      notes: notes.length ? notes : undefined,
    };
  }

  async compareTrackSessions(
    options: CompareTrackSessionsOptions
  ): Promise<RunComparison> {
    const { records } = this.load();
    const developmentOf = (r: TrackSessionRecord) =>
      developmentFromBasis(r.basis)?.meters;
    const resolved = options.runs.map((ref) =>
      resolveRunRef(ref, records, developmentOf, options.segmentLaps)
    );
    return compareRuns(resolved);
  }
}

export function createTrackSessions(
  deps: TrackSessionsDeps = {}
): TrackSessions {
  return new TrackSessions(deps);
}

export {
  parseTrackSessionRecord,
  TrackRecordError,
  DEFAULT_ROLLOUT_MM,
} from "./record.js";
export {
  loadTrackSessionRecords,
  recordsDir,
  DEFAULT_RECORDS_DIR,
} from "./loader.js";
export type { LoadedRecords } from "./loader.js";
export {
  deriveRun,
  developmentFromBasis,
  segmentLapsFor,
  startFor,
  MAX_SEGMENT_LAPS,
} from "./derive.js";
export { compareRuns, resolveRunRef, TrackComparisonError } from "./compare.js";
export type {
  RunStart,
  SessionKind,
  SessionBasis,
  TrackSessionRecord,
  DerivedLap,
  SegmentSummary,
  PacingSummary,
  RunSummary,
  DerivedRun,
  TrackSessionDetail,
  TrackSessionListing,
  ListTrackSessionsResult,
  ComparisonLapRow,
  ComparisonSummaryRow,
  RunComparison,
  GetTrackSessionOptions,
  CompareTrackSessionsOptions,
} from "./types.js";
