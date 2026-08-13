import { writeTrackRuns, type TrackLapWritebackDeps } from "./writeback.js";
import type { TrackRunWriteOptions, TrackRunWriteResult } from "./types.js";

export interface ITrackLapWriteback {
  writeTrackRuns(options: TrackRunWriteOptions): Promise<TrackRunWriteResult>;
}

export class TrackLapWriteback implements ITrackLapWriteback {
  constructor(private deps: TrackLapWritebackDeps) {}

  async writeTrackRuns(
    options: TrackRunWriteOptions
  ): Promise<TrackRunWriteResult> {
    return writeTrackRuns(this.deps, options);
  }
}

export function createTrackLapWriteback(
  deps: TrackLapWritebackDeps
): TrackLapWriteback {
  return new TrackLapWriteback(deps);
}

export { writeTrackRuns, composeLabel } from "./writeback.js";
export type { TrackLapWritebackDeps } from "./writeback.js";
export { snapRun, boundaryTime } from "./snap.js";
export type { SnappedRun, SnappedBoundary } from "./snap.js";
export type {
  TrackRunWriteOptions,
  TrackRunWriteResult,
  WrittenRun,
  WriteMode,
} from "./types.js";
