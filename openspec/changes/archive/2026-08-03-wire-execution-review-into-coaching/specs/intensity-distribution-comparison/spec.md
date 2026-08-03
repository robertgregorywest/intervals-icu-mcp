## Purpose

Answers "was the prescribed dose actually delivered?" by computing the planned intensity distribution from the prescribed session itself and the delivered one from the recorded power, in a single shared frame — so the comparison holds the athlete to the workout as prescribed, still reports where step-to-interval alignment is impossible, and makes the middle-band dose the coaching philosophy treats as load-bearing a measured number.

## ADDED Requirements

### Requirement: Compute both distributions in one shared frame

The system SHALL derive the planned distribution from the prescribed session's own steps and the delivered distribution from the activity's recorded power, bucketing both against the same zone boundaries, and SHALL NOT read either distribution from a precomputed figure supplied by the platform.

#### Scenario: Planned distribution derived from the prescription

- **WHEN** a planned session's steps are bucketed
- **THEN** each step contributes its prescribed duration at its prescribed absolute power, so the planned distribution reflects the workout as prescribed rather than the platform's rendering of it at authoring time

#### Scenario: Delivered distribution derived from recorded power

- **WHEN** an activity's delivered distribution is computed
- **THEN** it is bucketed from the recorded power against the same boundaries used for the planned side

#### Scenario: Threshold moved between prescription and execution

- **WHEN** the athlete's threshold changed between the session being prescribed and being ridden
- **THEN** the comparison is unaffected, because both sides are bucketed in one frame and the prescription is expressed in absolute power

#### Scenario: Zone boundaries reported with the comparison

- **WHEN** a comparison is returned
- **THEN** it states the zone boundaries used, so the reader can see the frame the seconds were bucketed into

### Requirement: Bucket a range target by its midpoint

The system SHALL assign a step prescribing a range of power wholly to the zone containing that range's midpoint, matching the convention the step-level comparison already uses for judging a progression. This governs the per-zone breakdown only; the middle-band roll-up takes a range proportionally, per its own requirement below.

#### Scenario: Range within one zone

- **WHEN** a step prescribes a range lying inside a single zone
- **THEN** its full prescribed duration is assigned to that zone

#### Scenario: Range spanning a zone boundary

- **WHEN** a step prescribes a range whose ends fall in different zones
- **THEN** its full prescribed duration is assigned to the zone containing the range's midpoint, and the comparison records that the step's range spanned a boundary

#### Scenario: Step with no resolvable power target

- **WHEN** a planned step's power target cannot be resolved to absolute watts
- **THEN** its duration is excluded from the planned distribution and reported as unbucketed, rather than assigned to a zone by guesswork

### Requirement: Report zones in the athlete's coaching frame and the middle band explicitly

The system SHALL bucket into a total, disjoint frame derived from the athlete's coaching zones, and SHALL additionally report a middle-band roll-up for the tempo-through-threshold power window as a distinct figure, because that window is the coaching philosophy's primary judge of a build week.

#### Scenario: Coaching zones used as the frame

- **WHEN** the athlete's coaching zones are available
- **THEN** the per-zone breakdown carries those zones' names

#### Scenario: Overlapping coaching bands reduced to a partition

- **WHEN** the athlete's coaching zones overlap one another, as the MAP-anchored training bands do
- **THEN** the system buckets against a partition derived from them by assigning each wattage to the highest zone whose lower bound it reaches, so that no second is counted in two zones and the per-zone seconds sum to the total

#### Scenario: Derived frame not presented as the coaching bands

- **WHEN** a per-zone breakdown is returned against a derived partition
- **THEN** the reported boundaries are the partition's own, not the coaching bands they were derived from, so a reader cannot mistake one frame for the other

#### Scenario: Middle band reported as its own window

- **WHEN** a comparison is returned
- **THEN** it includes the planned seconds, delivered seconds, delta, and delivered fraction for the middle-band power window, computed from that window's own bounds rather than by summing whichever coaching zones happen to approximate it

#### Scenario: Prescribed range straddling the middle band's bound

- **WHEN** a step prescribes a range of power only part of which lies inside the middle band
- **THEN** the step contributes that part's share of its prescribed duration to the planned middle-band figure, rather than all or none of it according to which side its midpoint fell

#### Scenario: Prescribed range wholly inside or outside the middle band

- **WHEN** a step's prescribed range lies entirely within the middle band, or entirely outside it
- **THEN** the step contributes all, or none, of its prescribed duration to the planned middle-band figure

#### Scenario: Dose shortfall distinguished from redistribution

- **WHEN** the delivered session holds the same total duration as planned but less time in the middle band
- **THEN** the roll-up reports the middle-band shortfall, so that a session which kept its duration while losing its prescribed intensity is not reported as delivered

#### Scenario: Coaching zones unavailable

- **WHEN** the athlete's coaching zones cannot be determined
- **THEN** the system returns no per-zone breakdown and names the reason, but still reports the middle-band roll-up, whose bounds do not depend on those zones

### Requirement: Work without step alignment

The system SHALL produce a comparison whenever the prescription and the recorded power are both available, regardless of whether the planned steps could be paired to recorded intervals.

#### Scenario: Session that defeats step alignment

- **WHEN** the paired session is one for which step-level comparison declines to align — for example a session ridden with no head unit, or recorded as a small number of coarse auto-detected intervals
- **THEN** the system still returns the full per-zone comparison and middle-band roll-up

#### Scenario: Session abandoned partway

- **WHEN** the delivered session is materially shorter than prescribed
- **THEN** the system returns the comparison with the shortfall visible in the per-zone deltas and in the roll-up, rather than declining to report

### Requirement: Resolve the pair and refuse explicitly

The system SHALL accept exactly one of an activity identifier or an event identifier for a single-session comparison, resolve the other half the same way the step-level comparison does, and return a machine-readable reason with every result that carries no comparison.

#### Scenario: Both or neither identifier supplied

- **WHEN** a caller supplies both an activity identifier and an event identifier, or neither
- **THEN** the system rejects the request with an error stating that exactly one identifier is required, before issuing any request for data

#### Scenario: Prescription absent

- **WHEN** the planned event carries no structured steps
- **THEN** the system returns no comparison and names the reason, rather than treating the planned distribution as zero

#### Scenario: Recorded power absent

- **WHEN** the completed activity has no recorded power
- **THEN** the system returns no comparison and names the reason, rather than treating the delivered distribution as zero

#### Scenario: Reason accompanies every dead end

- **WHEN** the system returns a result with no per-zone comparison
- **THEN** the result carries a reason code identifying the cause and a human-readable message expanding it

### Requirement: Count each recorded power sample as one second of recording time

The system SHALL treat every sample of the recorded power stream as one second at that wattage, so that delivered seconds sum to the time the activity was actually recording.

#### Scenario: Delivered seconds sum to recording time

- **WHEN** a delivered distribution is computed
- **THEN** its per-zone seconds sum to the number of recorded power samples, which is the activity's recording time rather than its elapsed time

#### Scenario: Paused recording

- **WHEN** the activity's recording was paused, so that its elapsed time exceeds the span the samples cover
- **THEN** the paused time contributes to no zone, rather than being credited to the wattage recorded either side of the pause

### Requirement: Aggregate a date range

The system SHALL accept a date range in place of a single identifier and report the summed planned and delivered distribution across every paired session in that range, together with the per-session figures.

#### Scenario: Range aggregated

- **WHEN** a caller supplies a start and end date
- **THEN** the system returns the summed per-zone planned seconds, delivered seconds, and deltas across all paired sessions in the range, plus the middle-band roll-up for the range

#### Scenario: Per-session detail retained

- **WHEN** a range comparison is returned
- **THEN** it also lists each contributing session with its date, name, and middle-band figures, so a pattern across sessions is visible rather than only its sum

#### Scenario: Unpairable sessions excluded and reported

- **WHEN** the range contains completed activities with no planned event, or planned events with no completed activity
- **THEN** the system excludes them from the sums and reports them separately, so the aggregate is never inflated or deflated by unpaired work

#### Scenario: Range exceeds the supported window

- **WHEN** the supplied range is longer than the maximum supported window
- **THEN** the system rejects the request with an error naming the limit, before issuing any request for data
