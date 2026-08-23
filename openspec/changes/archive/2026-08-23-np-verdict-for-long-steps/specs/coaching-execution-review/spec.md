## MODIFIED Requirements

### Requirement: Read verdicts as coaching, not as compliance

The coaching session SHALL interpret step verdicts against the role each step plays in the session, and SHALL NOT report verdicts verbatim.

#### Scenario: Work steps carry the intent

- **WHEN** verdicts are read for a reviewed session
- **THEN** only steps carrying the session's prescribed intent are treated as findings; warm-up, recovery, and cool-down steps are not reported as misses

#### Scenario: Under-delivery on a recovery step is not a miss

- **WHEN** a recovery step was delivered below its prescribed power
- **THEN** the review treats this as recovery taken at least as easily as prescribed, and does not report it as a shortfall

#### Scenario: Work-step and support-step roles are derived

- **WHEN** the review distinguishes work steps from support steps
- **THEN** it derives the distinction from each step's prescribed intensity relative to the athlete's coaching zones together with its structural position in the prescribed session, and does not rely on step labels alone

#### Scenario: Small deltas on range targets are not findings

- **WHEN** a step prescribed a range rather than a single value and was delivered close to that range
- **THEN** the review does not report it, recognising that a range target carries no tolerance and so reports small deltas as directional verdicts

#### Scenario: A refusal to align is not a failed session

- **WHEN** a comparison reports that it declined to align planned steps to recorded intervals
- **THEN** the review reports the session as unverified on the step lens and falls back to the distribution lens, and does not report it as a session the athlete failed to complete

#### Scenario: Platform compliance is not the verdict

- **WHEN** the platform's own compliance figure is available for a reviewed session
- **THEN** the review may cite it as context but SHALL NOT substitute it for its own reading of the delivered work

#### Scenario: An average-watts verdict is discounted on a coasted long step

- **WHEN** a reviewed step's verdict basis is average power, its prescribed duration exceeds five minutes, and its coasting fraction is non-trivial
- **THEN** the review does not quote that step's average-watts delta as a finding on its own, and reads the step's normalized power instead, since normalized power is the honest read of a long outdoor step whose average is depressed by coasting

#### Scenario: A normalized-power verdict is read as delivered

- **WHEN** a reviewed step's verdict basis is normalized power
- **THEN** the review treats that verdict as the step's delivery finding without separately re-deriving or citing the average-watts delta for the same step
