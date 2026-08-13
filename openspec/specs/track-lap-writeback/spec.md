# track-lap-writeback Specification

## Purpose

Writes a fitted track lap alignment back onto the Intervals.icu activity as one interval per scored run, so that the efforts an athlete actually rode become objects they can see on the chart and that Intervals.icu's own interval machinery can work with — while disclosing every way the written boundaries differ from the fitted ones, and how well each run was placed.

## Requirements

### Requirement: Each scored run is written as a single interval

The system SHALL accept an activity identifier and a lap-split record, align them by the same means as the read-only alignment, and write each scored run onto that activity as one Intervals.icu interval.

A run's interval SHALL span the start of its first timed lap to the end of its last. Individual laps SHALL NOT be written as separate intervals.

Because the scored run excludes the rolling entry, the written interval SHALL likewise exclude it: time the athlete spent winding up to the line SHALL fall outside every written interval.

The system SHALL NOT send derived metrics — power, cadence, heart rate, distance, duration — with the write. Those SHALL be left for Intervals.icu to recompute from the written boundaries, so that the figures shown in the UI are its own and cannot silently disagree with it.

#### Scenario: A session of four runs is written

- **WHEN** the caller supplies an activity and a lap-split record of four scored runs
- **THEN** the activity carries four written intervals, one per run, each spanning that run's first lap start to its last lap end, and the response reports how many were written

#### Scenario: The rolling entry stays outside

- **WHEN** a run scored over 114.26 s was ridden with a rolling entry
- **THEN** the written interval covers the 114.26 s of the scored run, and the wind-up preceding it lies outside it

#### Scenario: Metrics are the platform's, not ours

- **WHEN** a run is written whose fitted average power is known
- **THEN** the request carries only the boundaries and label, and the power the activity subsequently reports for that interval is the platform's own computation over the written boundaries

### Requirement: Every written run is labelled with its identity and its fit

Each written interval SHALL carry a label naming the run verbatim as the lap-split record gave it, so the athlete finds on the chart the same run name their timing export uses.

Where a run's alignment verdict is anything other than `strong`, the label SHALL also state that verdict. The label is the only field the platform preserves, and so the only place the quality of a placement can be seen by a reader looking at the activity rather than at the tool's response.

#### Scenario: A strongly aligned run

- **WHEN** a run identified as `Run 2` in the lap-split record aligns strongly
- **THEN** its interval is labelled with that run identifier and no verdict qualifier

#### Scenario: An ambiguously aligned run

- **WHEN** a run's alignment verdict is `ambiguous`
- **THEN** its interval's label carries both the run identifier and the ambiguous verdict, so a reader of the activity can see the placement is uncertain without consulting the tool

### Requirement: The write replaces the activity's whole interval set

A write SHALL replace the intervals already on the activity rather than adding to them, so that running the same write twice leaves the activity in the same state as running it once.

The system SHALL retrieve and report a summary of the intervals it replaced, so the caller learns what was discarded rather than discovering it afterwards.

The response SHALL state that any stretch of the activity not covered by a written run is filled by the platform's own intervals, so the caller is not surprised by intervals in the result that were never written.

#### Scenario: Re-running the same write

- **WHEN** the same activity and lap-split record are written twice in succession
- **THEN** the activity carries exactly one interval per scored run after the second write, not two, and the second response reports that it replaced the runs the first write left

#### Scenario: An activity with existing analysis

- **WHEN** the target activity already carries eighteen auto-detected intervals
- **THEN** the response reports that eighteen intervals were replaced before the runs were written

#### Scenario: The gaps between runs

- **WHEN** four runs are written into an activity that also contains warm-up and recovery riding
- **THEN** the stretches between the written runs are filled by the platform, and the response states this so an interval count greater than four reads as expected

### Requirement: Boundaries are snapped to sample indices and the drift is disclosed

Intervals on the target platform are anchored to whole stream samples, while the alignment places run boundaries at fractional times. The system SHALL snap each run's start and end to the nearest stream sample and SHALL report, for every written run, how far each boundary moved in the snap.

The system SHALL also report, for every written run, the reading the snapped boundaries produce alongside the reading the fitted boundaries produced, so that a caller comparing the activity against the read-only alignment can see exactly where and by how much the two disagree.

Snapping SHALL never be silent, and the system SHALL NOT present a snapped figure as though it were the fitted one.

#### Scenario: A boundary between samples

- **WHEN** a run ends 114.26 s after its start and the activity's samples fall on whole seconds
- **THEN** the written boundary sits on the nearer whole second and the response reports the 0.26 s the boundary moved

#### Scenario: Snapped and fitted readings differ

- **WHEN** snapping a run's boundaries changes its average power relative to the fitted alignment
- **THEN** the response carries both figures for that run, so the discrepancy is visible without re-running the alignment

### Requirement: Every placed run is written, carrying its verdict

The system SHALL write every run the alignment placed, whatever that run's alignment verdict. A verdict that withholds per-lap readings SHALL NOT withhold the run, because run-level readings remain robust across the fitted offset interval even where individual lap boundaries cannot be placed.

Each written run's alignment verdict SHALL be reported, and where it is not `strong` the reason SHALL be reported with it.

Where the alignment places no run at all, nothing SHALL be written and the activity's existing intervals SHALL be left untouched.

#### Scenario: A weakly aligned run among strong ones

- **WHEN** three runs align strongly and a fourth aligns too weakly to place its individual laps
- **THEN** all four runs are written, the fourth's verdict and reason are reported and carried in its label, and no run is dropped

#### Scenario: No run can be placed

- **WHEN** no run in the record aligns well enough to be placed
- **THEN** nothing is written, the activity's existing intervals are left untouched, and the response states that no run could be placed

### Requirement: A write can be previewed without touching the activity

The system SHALL offer a mode that performs the alignment, composes the labels and snaps the boundaries, and returns exactly what would be written — without issuing any write against the activity.

A previewed result SHALL be distinguishable from a performed one in the response, so a caller can never mistake a preview for a completed write.

#### Scenario: Previewing a write

- **WHEN** the caller asks for a preview
- **THEN** the response contains the intervals and labels that would be written together with their snap drift, the activity's intervals are unchanged, and the response identifies itself as a preview

### Requirement: The write fails loudly rather than leaving the activity half-changed

Where the inputs cannot support a write, the system SHALL reject the request before issuing it, with a message naming the specific problem, and SHALL leave the activity's intervals untouched.

Every condition under which the alignment itself refuses — no cadence stream, an unparseable lap-split record, splits that do not reconcile, no candidate window able to hold a run — SHALL cause the write to be refused on the same terms.

Where the platform rejects the write, the system SHALL report the failure rather than reporting a success it did not achieve.

#### Scenario: An activity with no cadence stream

- **WHEN** the target activity carries no cadence stream
- **THEN** the request is rejected with a message naming the missing stream and no write is attempted

#### Scenario: Splits that do not reconcile

- **WHEN** a run's lap times do not sum to its cumulative times within tolerance
- **THEN** the request is rejected naming the run and the discrepancy, and no write is attempted

#### Scenario: The platform rejects the write

- **WHEN** the intervals write is refused by Intervals.icu
- **THEN** the failure is reported with the platform's reason, and the response does not claim any run was written

### Requirement: The write is declared as a mutating, destructive operation

The system SHALL declare this operation as one that modifies and discards data, so that every surface exposing it can gate it accordingly rather than treating it as a read.

#### Scenario: Surfaced on a command surface

- **WHEN** the operation is projected onto a surface that distinguishes read-only from mutating operations
- **THEN** it is presented as mutating and destructive, and requires explicit confirmation before it runs
