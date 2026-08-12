## Purpose

Joins an external lap-timer record of a track session to the recorded activity's streams, so that each timed lap can be read with the power, cadence and heart rate that produced it, and so that the quality of that join is reported as a number rather than assumed.

## ADDED Requirements

### Requirement: Per-lap readings for every timed run

The system SHALL accept an activity identifier and a lap-split record describing one or more runs, and return, for each lap of each run, the lap's timed duration, average power, average cadence and average heart rate, together with the same aggregates for the run as a whole.

Lap readings SHALL be computed over the interval the lap timer defines — the lap's own start and end within the run — and never over a detected-interval boundary, a device lap, or a distance-interpolated boundary.

Where a lap boundary falls between two stream samples, the boundary sample SHALL be apportioned rather than rounded to the nearest sample.

#### Scenario: Four runs from one session

- **WHEN** the caller supplies an activity with 1 Hz power, cadence and heart-rate streams and a lap-split record of four runs
- **THEN** the response contains four runs, each carrying one reading per timed lap plus the run's aggregate power, cadence, heart rate and duration

#### Scenario: A stream the activity does not carry

- **WHEN** the activity has no heart-rate stream
- **THEN** power and cadence readings are still returned, the heart-rate fields are reported absent rather than zero, and the result is not rejected

#### Scenario: Boundary between samples

- **WHEN** a lap ends 16.26 s into a run and stream samples fall on whole seconds
- **THEN** the sample straddling the boundary contributes to each adjacent lap in proportion to the time it spends in that lap

### Requirement: The rolling entry is excluded from the scored run

The system SHALL locate each run's scored start within the activity by fitting, and SHALL report readings only from that start onwards. Time the athlete spent winding up to the line — a flying entry, warm-up laps, a rolling start — SHALL fall outside every returned lap and SHALL NOT contribute to any returned average.

#### Scenario: Flying entry ahead of a scored run

- **WHEN** a run scored over 114.26 s was ridden with a rolling entry, and the surrounding above-threshold effort spans roughly 120 s
- **THEN** the returned run covers 114.26 s of stream, its first lap begins at the scored start, and the wind-up laps preceding it appear in no lap reading

### Requirement: Alignment is fitted against cadence, not assumed

The system SHALL determine each run's position in the activity by fitting the recorded cadence against the cadence each timed lap implies, with the drivetrain rollout treated as a fitted parameter rather than a supplied constant.

Each run SHALL be matched to exactly one candidate window of the activity, and runs SHALL be matched in the order the lap-split record gives them, so that two runs can never resolve to the same stretch of the session.

The fitted rollout SHALL be returned for each run, and its spread across runs SHALL be reported.

#### Scenario: Two runs of identical length in one session

- **WHEN** a session contains two runs of the same distance and near-identical lap times
- **THEN** each run is matched to a distinct window of the activity and the two runs report different start offsets

#### Scenario: Rollout recovered from the fit

- **WHEN** a session of four runs is aligned successfully
- **THEN** each run reports the rollout its own fit recovered, and the result reports the spread across the four as a consistency signal

### Requirement: Alignment confidence is quantified and reported

Every run in the response SHALL carry a confidence report containing at minimum: the residual of the cadence fit in rpm, the margin by which the chosen alignment beat the next-best distinct alignment, and a verdict classifying the fit.

The verdict SHALL be derived from published thresholds, and the response SHALL state the thresholds used so a reader can judge the verdict without re-deriving it.

#### Scenario: A good fit

- **WHEN** the cadence fit for a run leaves a residual under 1 rpm and clearly beats the next-best offset
- **THEN** the run's verdict reports the alignment as strong and the per-lap readings are returned

#### Scenario: A weak fit

- **WHEN** the cadence fit for a run leaves a residual large enough to put lap boundaries in doubt
- **THEN** the run's verdict reports the alignment as weak, the reason is stated, and the weakness is visible in the response without the caller having to inspect the residual themselves

#### Scenario: An ambiguous fit

- **WHEN** a second, materially different alignment fits the run nearly as well as the chosen one
- **THEN** the run is reported as ambiguous and the competing alignment is disclosed

### Requirement: The system fails loudly rather than returning a plausible fiction

Where the inputs cannot support the result asked of them, the system SHALL say so instead of returning numbers that look reasonable.

The system SHALL reject the request, with a message naming the specific problem, when the activity carries no cadence stream, when the lap-split record cannot be parsed, when a run's lap times do not reconcile with its cumulative times, or when no candidate window can hold a run of the given duration.

Where a run aligns too weakly to support per-lap readings but well enough to place the run as a whole, the system SHALL return the run-level aggregates, withhold the per-lap readings, and state why.

#### Scenario: No cadence stream

- **WHEN** the activity has no cadence stream
- **THEN** the request is rejected with a message naming the missing stream, and no aligned readings are returned

#### Scenario: Splits that do not reconcile

- **WHEN** a run's lap times do not sum to its cumulative times within tolerance
- **THEN** the request is rejected with a message naming the run and the discrepancy

#### Scenario: Too weak for per-lap output

- **WHEN** a run's fit is too weak to place individual lap boundaries but places the run
- **THEN** the run's aggregates are returned, its per-lap readings are withheld, and the response states that per-lap output was withheld and why

#### Scenario: Stream resolution too coarse for the lap length

- **WHEN** the activity's stream sampling interval is too coarse to resolve laps of the supplied length
- **THEN** the response withholds per-lap readings and states the sampling interval that caused it, rather than interpolating across it

### Requirement: Lap splits are accepted as exported

The system SHALL accept the lap-split record in the CSV form the timing app exports — a run identifier, a cumulative distance, a cumulative time and a lap time per row — without the caller having to reshape it.

The lap distance SHALL default to 250 m and SHALL be overridable for tracks of another length.

#### Scenario: Pasted export

- **WHEN** the caller passes the exported CSV text unmodified, including its header row
- **THEN** the runs and laps are parsed from it and aligned

#### Scenario: A track that is not 250 m

- **WHEN** the caller supplies a lap distance of 333.33 m
- **THEN** implied lap speeds and the fitted rollout are computed against that distance
