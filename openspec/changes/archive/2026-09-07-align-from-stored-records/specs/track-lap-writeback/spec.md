## MODIFIED Requirements

### Requirement: The write fails loudly rather than leaving the activity half-changed

Where the inputs cannot support a write, the system SHALL reject the request before issuing it, with a message naming the specific problem, and SHALL leave the activity's intervals untouched.

The system SHALL accept the same lap-split input as an alignment request — inline splits, or the identifier of a stored track session record — so that what was previewed by an alignment can be written from identical inputs.

Every condition under which the alignment itself refuses — no cadence stream, an unparseable lap-split record, splits that do not reconcile, an input naming both an export and a record or neither, a record with no activity behind it, no candidate window able to hold a run — SHALL cause the write to be refused on the same terms.

Where the platform rejects the write, the system SHALL report the failure rather than reporting a success it did not achieve.

#### Scenario: An activity with no cadence stream

- **WHEN** the target activity carries no cadence stream
- **THEN** the request is rejected with a message naming the missing stream and no write is attempted

#### Scenario: Splits that do not reconcile

- **WHEN** a run's lap times do not sum to its cumulative times within tolerance
- **THEN** the request is rejected naming the run and the discrepancy, and no write is attempted

#### Scenario: Written from a stored record

- **WHEN** the caller names a stored track session record instead of pasting splits
- **THEN** the export, the activity and the lap distance are taken from that record and the runs written are those the alignment would have fitted from the same inputs

#### Scenario: An input the alignment would refuse

- **WHEN** the caller supplies both an export and a record identifier, neither, or a record carrying no activity
- **THEN** the request is rejected on the same terms as the alignment and no write is attempted

#### Scenario: The platform rejects the write

- **WHEN** the intervals write is refused by Intervals.icu
- **THEN** the failure is reported with the platform's reason, and the response does not claim any run was written
