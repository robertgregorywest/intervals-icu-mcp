# planned-vs-actual-comparison Specification

## Purpose

Answers "was this session executed as prescribed?" by pairing a completed activity with its planned event and reporting, step by step, what was prescribed against what was delivered — with an explicit alignment basis and an explicit refusal whenever a confident pairing is not possible.

## Requirements

### Requirement: Resolve the planned/actual pair from either side

The system SHALL accept exactly one of an activity identifier or an event identifier and resolve the missing half of the pair from the activity's recorded pairing, without inferring the pairing from dates.

#### Scenario: Activity given

- **WHEN** a caller supplies only an activity identifier and that activity records a paired event
- **THEN** the system resolves that event as the planned side and reports both identifiers in the response

#### Scenario: Event given

- **WHEN** a caller supplies only an event identifier
- **THEN** the system locates the completed activity whose recorded pairing points at that event and uses it as the actual side

#### Scenario: Both identifiers supplied

- **WHEN** a caller supplies both an activity identifier and an event identifier
- **THEN** the system rejects the request with an error stating that exactly one identifier is required, before issuing any request for data

#### Scenario: Neither identifier supplied

- **WHEN** a caller supplies neither an activity identifier nor an event identifier
- **THEN** the system rejects the request with the same error, before issuing any request for data

#### Scenario: Activity has no paired event

- **WHEN** the supplied activity records no paired event
- **THEN** the system returns a result with no step alignment, an alignment basis of `none`, and a reason identifying that the activity is not paired to a planned workout

#### Scenario: Event has no completed activity

- **WHEN** the supplied event has no completed activity paired to it
- **THEN** the system returns a result with no step alignment, an alignment basis of `none`, and a reason identifying that the planned session was not executed or not yet uploaded

### Requirement: Expand the planned session into comparable steps

The system SHALL read the planned session's structured steps from the event and flatten them into an ordered list of prescribed steps, expanding repeat blocks so that each repetition is a separate comparable step.

#### Scenario: Repeat block expanded rep by rep

- **WHEN** the planned session contains a repeat block of N repetitions over M steps
- **THEN** the flattened list contains N × M prescribed steps, each carrying its repeat index and its position within the repetition

#### Scenario: Prescribed values carried through

- **WHEN** a planned step specifies a duration and a power target
- **THEN** the flattened step carries the prescribed duration in seconds and the prescribed power target, preserving a range target as a range rather than collapsing it to a single number

#### Scenario: A ramp is distinguished from a range

- **WHEN** a planned step prescribes a progression between two power values rather than an acceptable range between them
- **THEN** the flattened step records that its two values are the ends of a ramp, so that it is not later judged as though any value between them were acceptable

#### Scenario: Percent target with no reference to resolve it

- **WHEN** a planned step states its power target as a percentage and neither the event nor the activity carries an FTP to resolve it against
- **THEN** the system records that the target is unresolved, naming the reason, and SHALL NOT assume a reference value

#### Scenario: Planned session has no structured steps

- **WHEN** the paired event carries no structured workout steps
- **THEN** the system returns a result with no step alignment, an alignment basis of `none`, and a reason identifying that the planned event has no structured steps to compare against

### Requirement: Read what was delivered from the device's own record

The recorded intervals a comparison judges SHALL be taken from the laps the recording device wrote, decoded from the activity's original upload, whenever those laps are available and record structure. The platform's own interval analysis is a derived, editable segmentation that may re-cut step boundaries, and SHALL be used only as a fallback. Every result SHALL name which record it read.

The system SHALL NOT choose between the two records by which of them aligns better. Detection re-cuts boundaries to fit the power trace, so it scores best precisely where it has invented the structure the comparison exists to check. The records SHALL be tried in preference order, and the derived one used only when the device's laps produce no alignment at all.

#### Scenario: Laps preferred over the derived analysis

- **WHEN** the activity's original upload yields laps recording more than one segment
- **THEN** the comparison judges the prescribed steps against those laps and reports its execution record as the device's laps

#### Scenario: Derived analysis scores better and is still not used

- **WHEN** the device's laps produce an alignment and the platform's interval analysis would produce a more complete one
- **THEN** the comparison reports the lap-based result, because a segmentation re-cut to fit is not evidence that it is right

#### Scenario: Laps unavailable

- **WHEN** the activity has no original upload, the upload is not readable as a lap-bearing file, or the recorded laps do not survive decoding
- **THEN** the comparison falls back to the platform's interval analysis and reports that as its execution record, rather than refusing the comparison

#### Scenario: Ride was never lapped

- **WHEN** the original upload yields a single lap spanning the whole activity
- **THEN** the comparison treats that as recording no structure, falls back to the platform's interval analysis, and does not warn about the difference

#### Scenario: Derived analysis is known to have drifted

- **WHEN** the platform's interval analysis is used and the activity reports that the analysis has been edited or re-detected, or that the device recorded a different number of laps than the analysis contains
- **THEN** the comparison reports a note naming that drift, so per-step power is not read as though the boundaries were the ones ridden

#### Scenario: Reading the laps never costs the comparison

- **WHEN** the request for the original upload fails for any reason
- **THEN** the comparison proceeds on the platform's interval analysis, and the failure is not surfaced as an error

### Requirement: Align conservatively and report the basis

The system SHALL attempt to pair prescribed steps to recorded intervals, SHALL report which basis produced the pairing, and SHALL decline to pair rather than emit a pairing it cannot justify.

The reported basis SHALL be one of:

- `sequential` — prescribed steps and recorded intervals were paired in order, and their durations corroborate that order
- `duration` — pairing was derived from step durations and elapsed positions rather than from a one-to-one ordering
- `none` — no pairing was made

Alongside the basis the system SHALL report the fraction of prescribed steps that were paired, so a caller can tell a nearly-complete alignment from a sparse one without reading every step.

#### Scenario: Matched fraction reported

- **WHEN** any comparison is produced
- **THEN** the response reports what fraction of the prescribed steps were paired, including when the basis is `none`

#### Scenario: Structures correspond one to one

- **WHEN** the recorded intervals match the flattened prescribed steps in count and their durations corroborate the ordering
- **THEN** the system pairs them in order and reports the basis as `sequential`

#### Scenario: Structures differ but durations locate the work

- **WHEN** the counts differ but prescribed steps can be located within the recorded intervals by duration and elapsed position
- **THEN** the system pairs the steps it can locate, reports the basis as `duration`, and leaves the steps it could not locate unpaired

#### Scenario: No defensible pairing

- **WHEN** no pairing survives the system's corroboration checks
- **THEN** the system returns every prescribed step unpaired, reports the basis as `none`, and states in a reason why alignment failed

#### Scenario: Ambiguity is not resolved by guessing

- **WHEN** a prescribed step could plausibly pair with more than one recorded interval and no corroborating evidence separates them
- **THEN** the system leaves that step unpaired rather than selecting one of the candidates

#### Scenario: Activity has no recorded intervals

- **WHEN** the completed activity yields neither recorded laps nor a platform interval analysis
- **THEN** the system returns a result with no step alignment, an alignment basis of `none`, and a reason identifying the absence of intervals — it SHALL NOT substitute whole-activity averages for per-step delivery

### Requirement: Report a per-step verdict against a tolerance

For each prescribed step the system SHALL report the prescribed duration and power target alongside the delivered duration and average power, the signed deltas, and a verdict. The caller MAY supply a fractional tolerance; when omitted the system SHALL apply a default of 0.05.

The tolerance SHALL govern point targets only. A range target states the spread the prescription itself accepts, and the system SHALL NOT widen it further by the tolerance. A ramp target SHALL be judged against the midpoint of its two ends, as a point target.

Verdicts SHALL be:

- `on-target` — delivered power meets the prescribed target: within tolerance of a point target, or anywhere inside a range target
- `over` — delivered power exceeds the prescribed target: beyond tolerance above a point target, or above the upper end of a range target
- `under` — delivered power falls below the prescribed target: beyond tolerance below a point target, or below the lower end of a range target
- `not-attempted` — the step was paired but delivered materially less duration than prescribed
- `unmatched` — the step could not be compared: it paired to no recorded interval, or it paired but no power verdict could be reached

The system SHALL determine `not-attempted` before considering power, and the threshold that governs it SHALL be independent of the tolerance, so that loosening how strictly power is judged does not change what counts as an abandoned step.

#### Scenario: Delivered power inside tolerance

- **WHEN** a paired step prescribes 375 W, the tolerance is 0.05, and the recorded interval averaged 368 W
- **THEN** the verdict is `on-target` and the response reports a power delta of −7 W

#### Scenario: Delivered power below tolerance

- **WHEN** a paired step prescribes 375 W, the tolerance is 0.05, and the recorded interval averaged 330 W
- **THEN** the verdict is `under` and the response reports a power delta of −45 W

#### Scenario: Range target satisfied anywhere in band

- **WHEN** a paired step prescribes a power range and the delivered average falls inside that range
- **THEN** the verdict is `on-target` and the power delta is reported as zero

#### Scenario: Range target is not widened by the tolerance

- **WHEN** a paired step prescribes 255–275 W and the recorded interval averaged 244 W
- **THEN** the verdict is `under` and the response reports a power delta of −11 W measured from the lower end, whatever tolerance the caller supplied

#### Scenario: Ramp judged against its midpoint

- **WHEN** a paired step prescribes a ramp from 130 W to 220 W and the recorded interval averaged 135 W
- **THEN** the verdict is `under`, because a ramp prescribes a progression whose expected average is its midpoint, not a range within which any value is acceptable

#### Scenario: Paired step whose power cannot be judged

- **WHEN** a paired step's target is unresolved, or the paired interval recorded no power
- **THEN** the verdict is `unmatched` and the response states why no verdict could be reached, rather than reporting a comparison against an assumed value

#### Scenario: Step cut short

- **WHEN** a paired step's delivered duration is materially shorter than prescribed
- **THEN** the verdict is `not-attempted` and the response reports the duration delta

#### Scenario: Unpaired step

- **WHEN** a prescribed step has no paired interval
- **THEN** the verdict is `unmatched` and the delivered fields are absent rather than zero or estimated

#### Scenario: Caller-supplied tolerance applied

- **WHEN** the caller supplies a tolerance of 0.10
- **THEN** verdicts are computed against that tolerance and the tolerance used is echoed in the response

### Requirement: Report a whole-session roll-up

The system SHALL return a session-level summary alongside the step alignment, and this summary SHALL be produced even when step alignment fails.

#### Scenario: Load and duration compared

- **WHEN** a comparison is produced
- **THEN** the summary reports the planned training load, the actual training load, and the planned and actual total durations

#### Scenario: Platform compliance surfaced

- **WHEN** the activity carries the platform's own compliance value
- **THEN** the summary reports it, labelled as the platform's figure, distinct from the system's own per-step verdicts

#### Scenario: Unplanned work reported

- **WHEN** recorded intervals carry work that pairs to no prescribed step
- **THEN** the summary reports those intervals with their duration and average power as unplanned work

#### Scenario: Roll-up survives alignment failure

- **WHEN** alignment basis is `none`
- **THEN** the summary is still returned with planned and actual load and duration, and the step list is empty

### Requirement: Expose the comparison as a read-only tool on both adapters

The system SHALL expose the comparison as a single read-only tool registered once and available through both the MCP adapter and the CLI adapter, and the comparison SHALL NOT modify any activity or event.

#### Scenario: Available on both adapters

- **WHEN** the tool catalogue is enumerated on either adapter
- **THEN** the comparison tool appears with its arguments and is annotated read-only

#### Scenario: No writes performed

- **WHEN** the comparison runs
- **THEN** no request that creates, updates, or deletes an activity or event is issued

### Requirement: Make the comparison discoverable to a calling model

A tool that a model never learns about cannot close the verify gap, so the system SHALL name the comparison in the instructions the MCP server supplies to its client, and SHALL declare it in the distribution manifest alongside every other registered tool.

#### Scenario: Named in the server's instructions

- **WHEN** a client reads the instructions the MCP server supplies on connection
- **THEN** the comparison is named among the available operations, described as the step that verifies whether a session was executed as prescribed

#### Scenario: Declared in the distribution manifest

- **WHEN** the packaged manifest is checked against the tool registry
- **THEN** the comparison appears in the manifest, and the check reports the manifest and registry in sync
