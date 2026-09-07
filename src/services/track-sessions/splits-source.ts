/**
 * Hand a stored record's splits back to the tools that still take them inline.
 *
 * `compute_track_lap_power` and `write_track_runs` were written before records
 * existed, so their input is the export pasted as text. That is the one place
 * the export is still typed twice — once into the record, once into the call —
 * and a second transcription is a second chance to get a digit wrong. This
 * resolves a session id to the same three inputs the caller would have supplied
 * by hand.
 */

import { TrackComparisonError } from "./compare.js";
import type { TrackSessionRecord, TrackSplitsSource } from "./types.js";

/** The header `parseLapSplits` tolerates, written back out for readability. */
const SPLITS_HEADER = "run,cumDist,cumTime,lap";

/**
 * Re-serialise the parsed splits rather than storing the raw block.
 *
 * The record's runs are what `parseLapSplits` produced and reconciled, so
 * writing them back out gives the alignment exactly the numbers the record was
 * checked on. Any extra trailing columns the timing app exported are dropped,
 * which costs nothing — the parser ignores them.
 */
export function serializeSplits(record: TrackSessionRecord): string {
  const rows = record.runs.flatMap((run) =>
    run.laps.map((lap) =>
      [
        run.run,
        lap.cumulativeDistanceMeters,
        lap.cumulativeTimeSeconds,
        lap.lapTimeSeconds,
      ].join(",")
    )
  );
  return [SPLITS_HEADER, ...rows].join("\n");
}

export function resolveTrackSplits(
  sessionId: string,
  records: TrackSessionRecord[]
): TrackSplitsSource {
  const record = records.find((r) => r.basis.id === sessionId);
  if (!record) {
    const available = records.map((r) => r.basis.id).join(", ");
    throw new TrackComparisonError(
      `No track session record with id "${sessionId}".` +
        (available ? ` Available: ${available}.` : " No records are loaded.")
    );
  }

  return {
    sessionId: record.basis.id,
    splits: serializeSplits(record),
    // Absent on a race recorded from a timing export with no ride behind it —
    // 2025 Nationals is exactly that. The caller must then supply the activity.
    activityId: record.basis.activityId,
    lapDistanceMeters: record.basis.lapDistanceMeters,
    runs: record.runs.map((r) => r.run),
  };
}
