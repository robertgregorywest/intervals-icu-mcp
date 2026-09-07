# track-session-records Specification

## Purpose

Holds the timed lap splits of a track session as a durable, tracked record, and derives from it the
model-free quantities a pursuit is judged on — per-lap speed and cadence, run and flying-portion
aggregates, segment decomposition, decline, and the lap-by-lap comparison of two or more runs — so
that those numbers are computed from one measurement rather than transcribed into prose.

## Requirements

### Requirement: A session record is the export plus its measurement basis

The system SHALL read track session records from tracked files, one per session, each carrying a
measurement basis and the lap-timer export.

The basis SHALL include the session's date, the lap distance, and the drivetrain gear and rollout
from which development is derived. It MAY include the event, venue, kind, suit, crank length, an
activity identifier, and the provenance of the splits.

The export SHALL be stored in the CSV form the timing app produces — run identifier, cumulative
distance, cumulative time, lap time — and SHALL be parsed by the same parser and subjected to the
same reconciliation as an export passed inline to an alignment request.

A record SHALL be identified by a stable identifier, and a run within it by that identifier together
with the run label the export gives.

#### Scenario: A record is read

- **WHEN** a record file carries a basis and an export of one run of eight laps
- **THEN** the session is listed under its identifier with one run of eight laps, and the basis is
  returned alongside it

#### Scenario: A record whose splits do not reconcile

- **WHEN** a record's lap times do not sum to its cumulative column within tolerance
- **THEN** reading it fails with a message naming the record, the run and the size of the
  disagreement, rather than returning laps derived from an inconsistent record

#### Scenario: A record with no activity

- **WHEN** a record carries splits from a timing export but no activity identifier
- **THEN** it is read, listed and derived from in full, and only the quantities requiring streams are
  reported absent

### Requirement: Records may be absent

The system SHALL treat a missing or empty record directory as a session with no records, not as an
error, and SHALL report the location it looked in.

#### Scenario: No record directory

- **WHEN** the record directory does not exist
- **THEN** an empty list of sessions is returned together with a note naming the path searched, and
  no request fails

### Requirement: Derived quantities are computed on read, never stored

The system SHALL derive every reported quantity from the stored splits and basis at the time of the
request, and SHALL NOT read any derived figure from the record.

Per lap, the system SHALL report the lap time, the cumulative time, the speed implied by the lap
distance, and the cadence implied by the drivetrain development.

Development SHALL be derived from the gear ratio and the rollout, and SHALL NOT be reported in gear
inches.

#### Scenario: Per-lap speed and cadence

- **WHEN** a 250 m lap was timed at 15.59 s on a 65×16 drivetrain with a 2099 mm rollout
- **THEN** the lap reports a speed of 16.036 m/s and a cadence derived from a development of
  8.527 m per revolution

#### Scenario: A record without a gear

- **WHEN** a record supplies a development directly instead of a gear and rollout
- **THEN** cadence is derived from the supplied development

### Requirement: Aggregates are taken over the flying portion

The system SHALL identify each run's flying portion — every lap after the first when the run began
from a gate or standing start, and every lap when it began flying — and SHALL take the run's mean
lap time, mean speed and segment decomposition over that portion.

The standing or gate lap SHALL be reported in full as a lap and SHALL be excluded from every
aggregate.

#### Scenario: A gate-started 2 km

- **WHEN** a run of eight 250 m laps began from a gate
- **THEN** the flying portion covers laps 2 to 8 over 1750 m, and the run's mean lap time and mean
  speed are taken over those seven laps alone

#### Scenario: A flying training run

- **WHEN** a run of six laps began flying
- **THEN** the flying portion covers all six laps

### Requirement: Segment decomposition and decline

The system SHALL divide each run's flying portion into an opening and a closing segment of equal lap
count, chosen so that the two segments never overlap and always leave at least one lap between them,
and SHALL report each segment's time and mean speed.

The system SHALL report the **decline**: the ratio of the closing segment's mean speed to the
opening's, cubed, expressed as a proportional change. Where the two segments cannot be formed
without overlapping, the system SHALL report the decline absent rather than narrowing the gap.

#### Scenario: Decline over seven flying laps

- **WHEN** a run's flying portion is seven laps
- **THEN** the opening segment is the first three and the closing segment the last three, one lap
  separates them, and the decline is reported from their mean speeds

#### Scenario: A run too short to decompose

- **WHEN** a run's flying portion is three laps or fewer
- **THEN** the segments and the decline are reported absent, and the run's other aggregates are
  returned unaffected

### Requirement: The value of redistributing pace is reported

The system SHALL report, for each run's flying portion, the sum of squared lap speeds, the
root-mean-square speed, the time the same total squared speed would have produced had every lap been
ridden at that RMS speed, and the difference between that time and the time actually ridden.

#### Scenario: An unevenly paced race

- **WHEN** a flying portion of seven laps was ridden with lap speeds falling from 16.20 to 14.82 m/s
- **THEN** the RMS speed, the flat-equivalent time and the gain even pacing would have returned are
  reported, and the gain is a time in seconds

### Requirement: Runs are compared lap by lap

The system SHALL compare two or more runs, identified by session and run label, and SHALL report for
each lap position the value in each run and the difference between each run and the first run
listed.

The comparison SHALL also report, per run, the total time, the flying portion time, each segment's
time, and the decline.

The system SHALL refuse to compare runs whose flying portions differ in lap count, naming the runs
and their lap counts, rather than reporting a partially aligned table.

#### Scenario: Three races side by side

- **WHEN** three gate-started runs of eight laps are compared
- **THEN** the result carries eight lap rows with three values and two difference columns each, plus
  total, flying, segment and decline rows for all three

#### Scenario: Runs of different lengths

- **WHEN** a run of six laps is compared against a run of eight
- **THEN** the request is refused with a message naming both runs and their lap counts, and no
  partial table is returned

#### Scenario: The baseline is the caller's choice

- **WHEN** the same runs are compared with a different run listed first
- **THEN** the difference columns are taken against that run instead, and the underlying lap values
  are unchanged
