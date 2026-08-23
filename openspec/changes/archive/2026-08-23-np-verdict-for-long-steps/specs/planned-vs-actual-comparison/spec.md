## MODIFIED Requirements

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

Whenever the activity's raw power stream can be resolved to a paired step's window, the system SHALL additionally report normalized power over that window and the fraction of the window's samples recorded at zero watts, alongside the average power, regardless of which metric the verdict below is judged against.

For a paired step whose target is a range (and not a ramp) and whose prescribed duration exceeds 300 seconds, the verdict and its power deltas SHALL be judged against the step's normalized power rather than its average power, because average power over a long, wide-ranging outdoor step is depressed by coasting in a way normalized power is not. Every other step — a point target, a ramp, or a range target of 300 seconds or less — SHALL continue to be judged against average power. Whichever metric a step's verdict was judged against, the reported power deltas SHALL be computed from that same metric, and the system SHALL report which metric was used.

When normalized power cannot be resolved for a step that would otherwise be judged against it — the activity carries no usable power stream, or the step's window cannot be located in it — the system SHALL fall back to judging that step against average power rather than leaving it unjudged, and SHALL report that the fallback occurred.

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

#### Scenario: Long, wide-ranging step judged on normalized power

- **WHEN** a paired step prescribes a 190–235 W range, is prescribed for 25 minutes, and the recorded interval's raw power stream shows substantial coasting such that its average power of 164 W sits well below the band while its normalized power of 185 W sits inside it
- **THEN** the verdict is judged against the normalized power and reported as inside the band, the reported power delta is computed from normalized power, and the response states that the verdict was judged against normalized power

#### Scenario: Short range step stays on average power

- **WHEN** a paired step prescribes a power range and is prescribed for 4 minutes
- **THEN** the verdict and its power delta are judged against average power, and the response states that the verdict was judged against average power, regardless of how much of the window was coasted

#### Scenario: Point target stays on average power at any duration

- **WHEN** a paired step prescribes a single wattage and is prescribed for longer than 300 seconds
- **THEN** the verdict and its power delta are judged against average power, because a fixed-watt step is an instrument whose intent normalized power would obscure

#### Scenario: Ramp stays on average power at any duration

- **WHEN** a paired step prescribes a ramp and is prescribed for longer than 300 seconds
- **THEN** the verdict and its power delta continue to be judged against average power at the ramp's midpoint

#### Scenario: Normalized power and coasting fraction reported alongside every verdict basis

- **WHEN** a paired step's window can be resolved against the activity's raw power stream, whether or not that step's verdict is judged against normalized power
- **THEN** the response reports both the normalized power and the coasting fraction for that step's window

#### Scenario: No power stream available falls back to average power

- **WHEN** a step would otherwise be judged against normalized power but the activity carries no raw power stream, or the step's window cannot be located in it
- **THEN** the verdict is judged against average power instead, and the response states that the fallback occurred rather than leaving the step unjudged
