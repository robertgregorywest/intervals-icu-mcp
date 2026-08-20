## Purpose

Parses Intervals.icu workout text into the same parsed-document shape the platform returns, so a prescription can be analysed before it is written to the calendar — and so every existing planned-side lens reaches that analysis by the path it already uses.

## ADDED Requirements

### Requirement: Produce the platform's parsed-document shape

The system SHALL parse workout text into the same parsed-document shape Intervals.icu returns for an event, so that a document produced locally and a document supplied by the platform are interchangeable to every consumer.

#### Scenario: Text that has never been written

- **WHEN** workout text is parsed locally
- **THEN** the resulting document is consumable by the planned-side lenses on the same terms as a document the platform supplied, without those lenses distinguishing the two

#### Scenario: Same text, both sources

- **WHEN** the same workout text is parsed locally and by the platform
- **THEN** the two documents agree on the sequence of steps, each step's duration, and each step's power target

### Requirement: Reproduce the platform's step-reconstruction rules

The system SHALL reconstruct steps as the platform does, including expanding repeat blocks and discarding lines the platform discards, rather than producing a more literal reading of the text than the platform itself applies.

#### Scenario: Repeat block

- **WHEN** the text contains a repeat block introduced by a repeat count
- **THEN** the block's steps appear once per repetition, carrying their repetition index

#### Scenario: Step line carrying no duration

- **WHEN** a step line carries no parseable duration
- **THEN** it is discarded rather than emitted as a zero-duration step, matching the platform, and the discard is reported so an authoring mistake that would silently vanish from the athlete's workout is visible

#### Scenario: Free text outside step lines

- **WHEN** the text contains prose that is not a step line
- **THEN** it does not contribute a step

### Requirement: Resolve power targets against a stated anchor

The system SHALL resolve each step's power target to absolute watts against an anchor it names, resolving zone and percentage targets the way the platform resolves them, and SHALL report a target it cannot resolve rather than substituting a default.

#### Scenario: Absolute watt target

- **WHEN** a step prescribes watts directly
- **THEN** the target is carried through unchanged and is unaffected by the anchor

#### Scenario: Zone target

- **WHEN** a step prescribes a training zone
- **THEN** it resolves against the athlete's FTP-anchored power zones — the frame the platform itself uses for workout text — and the result names that frame, notwithstanding that the coaching layer reasons in MAP zones elsewhere

#### Scenario: Percentage target with no anchor available

- **WHEN** a step prescribes a percentage and no anchor is available
- **THEN** the target is reported as unresolved and named, and no wattage is guessed for it

### Requirement: State the fidelity contract's basis

The system SHALL state, with every parsed document, the anchor values used to resolve targets, so a downstream figure derived from a locally parsed prescription is never mistaken for one the platform computed.

#### Scenario: Document carries its basis

- **WHEN** a document is produced locally
- **THEN** it states that it was parsed locally and names the anchor values used
