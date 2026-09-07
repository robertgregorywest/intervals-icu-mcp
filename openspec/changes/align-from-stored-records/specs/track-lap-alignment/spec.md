## MODIFIED Requirements

### Requirement: Lap splits are accepted as exported

The system SHALL accept the lap-split record in the CSV form the timing app exports — a run identifier, a cumulative distance, a cumulative time and a lap time per row — without the caller having to reshape it.

The system SHALL alternatively accept the identifier of a stored track session record, and SHALL then take the splits, the activity and the lap distance from that record rather than from the request.

Splits supplied inline and a stored record identifier SHALL be mutually exclusive; a request carrying both SHALL be refused rather than one silently taking precedence.

Splits taken from a record SHALL be the reconciled runs and laps that record holds, so that an alignment is fitted to exactly the numbers the record's reconciliation passed.

The lap distance SHALL default to 250 m and SHALL be overridable for tracks of another length. A caller-supplied lap distance or activity SHALL override the record's.

#### Scenario: Pasted export

- **WHEN** the caller passes the exported CSV text unmodified, including its header row
- **THEN** the runs and laps are parsed from it and aligned

#### Scenario: Splits taken from a stored record

- **WHEN** the caller names a stored track session record instead of pasting splits
- **THEN** the export, the activity and the lap distance are taken from that record's basis and the alignment proceeds as if they had been supplied

#### Scenario: Both an export and a record named

- **WHEN** the caller supplies both inline splits and a record identifier
- **THEN** the request is refused, on the grounds that the two could disagree

#### Scenario: Neither an export nor a record named

- **WHEN** the caller supplies neither
- **THEN** the request is refused and names both accepted forms

#### Scenario: Pasted splits with no activity

- **WHEN** the caller pastes splits without an activity identifier
- **THEN** the request is refused, because there is no record from which to take one

#### Scenario: A record with no ride behind it

- **WHEN** the caller names a record whose basis carries no activity identifier and supplies none
- **THEN** the request is refused and states that the record has no activity to align against, rather than failing while fetching streams

#### Scenario: A track that is not 250 m

- **WHEN** the caller supplies a lap distance of 333.33 m
- **THEN** implied lap speeds and the fitted development are computed against that distance
