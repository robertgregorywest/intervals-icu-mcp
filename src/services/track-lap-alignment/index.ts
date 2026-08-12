import { computeTrackLapPower, type TrackLapAlignmentDeps } from "./align.js";
import type { TrackLapAlignmentResult, TrackLapPowerOptions } from "./types.js";

export interface ITrackLapAlignment {
  computeTrackLapPower(
    options: TrackLapPowerOptions
  ): Promise<TrackLapAlignmentResult>;
}

export class TrackLapAlignment implements ITrackLapAlignment {
  constructor(private deps: TrackLapAlignmentDeps) {}

  async computeTrackLapPower(
    options: TrackLapPowerOptions
  ): Promise<TrackLapAlignmentResult> {
    return computeTrackLapPower(this.deps, options);
  }
}

export function createTrackLapAlignment(
  deps: TrackLapAlignmentDeps
): TrackLapAlignment {
  return new TrackLapAlignment(deps);
}

export { computeTrackLapPower, TrackAlignmentError } from "./align.js";
export type { TrackLapAlignmentDeps } from "./align.js";
export {
  parseLapSplits,
  SplitParseError,
  DEFAULT_LAP_DISTANCE_METERS,
} from "./splits.js";
export {
  detectCandidateWindows,
  assignRunsToWindows,
  searchRange,
  WindowError,
  SEARCH_MARGIN_SECONDS,
} from "./windows.js";
export {
  fitRun,
  residualAt,
  THRESHOLDS,
  STRONG_RESIDUAL_RPM,
  MARGINAL_RESIDUAL_RPM,
  AMBIGUOUS_RESIDUAL_RATIO,
  OFFSET_STEP_SECONDS,
} from "./fit.js";
export type { RunFit, ResidualAt } from "./fit.js";
export { windowMean, medianSampleInterval } from "./samples.js";
export type { TimedStream } from "./samples.js";
export type {
  LapSplit,
  RunSplits,
  CandidateWindow,
  Reading,
  AlignedLap,
  AlignedRun,
  AlignmentConfidence,
  AlignmentThresholds,
  AlignmentVerdict,
  RolloutAgreement,
  TrackLapAlignmentResult,
  TrackLapPowerOptions,
} from "./types.js";
