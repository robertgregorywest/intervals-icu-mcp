# coaching-execution-review Specification

## Purpose

Defines how a coaching session reviews what the athlete actually delivered before it plans anything further — which sessions get reviewed, over what window, through which lens, how the raw output is read as coaching rather than as compliance, and what reaches the athlete.

## Requirements

### Requirement: Execution review is the default opening move

The coaching session SHALL perform an execution review of the elapsed window as part of its session-start moves, before offering analysis, planning, or workout composition, so that every downstream judgement is conditioned on what was delivered rather than on what was planned.

#### Scenario: Open-ended session

- **WHEN** a coaching session begins without the athlete naming a narrower task
- **THEN** the review runs as part of session start and its findings are presented before any plan is drafted

#### Scenario: Narrowly-scoped request

- **WHEN** the athlete opens with a specific narrow request, such as moving a scheduled session
- **THEN** the review still runs so the coach holds full context, but the athlete's request is answered first and review findings are raised only where they bear on it

#### Scenario: Nothing notable found

- **WHEN** the review surfaces no finding that meets the reporting threshold
- **THEN** the coach states in a single line that the window's key sessions landed as prescribed, and does not present per-session detail

### Requirement: Window selection by log watermark

The coaching session SHALL determine the review window from a `reviewed-through` date recorded in the coaching log's live-state header, reviewing from that date to today, and SHALL advance the watermark at the logging checkpoint.

#### Scenario: Watermark present

- **WHEN** the coaching log header records a `reviewed-through` date
- **THEN** the review window runs from that date to today

#### Scenario: Watermark absent

- **WHEN** the coaching log has no `reviewed-through` date, including when the log does not yet exist
- **THEN** the review window defaults to the current block from the season plan, bounded by the maximum window

#### Scenario: Window below the minimum

- **WHEN** the watermark is recent enough that the window holds no key sessions
- **THEN** the review is skipped and the watermark is left unchanged, so that a second conversation on the same day does not re-review

#### Scenario: Window above the maximum

- **WHEN** the watermark is older than the maximum window — for example after a long absence
- **THEN** the review covers the most recent maximum window, and the coach states that earlier sessions were not reviewed

#### Scenario: Watermark advanced on write

- **WHEN** the session reaches its logging checkpoint and the athlete confirms the write
- **THEN** the `reviewed-through` date is advanced to today as part of that write, and not before

### Requirement: Key-session selection on prescribed intent

The coaching session SHALL select sessions for review by the intent of what was _prescribed_, not by what was delivered, and SHALL review sessions prescribing sweet spot or above.

#### Scenario: Selection from the planned side

- **WHEN** the review selects sessions in the window
- **THEN** selection reads the planned events, so that a prescribed key session which was abandoned or not started is selected rather than missed

#### Scenario: Sub-threshold sessions excluded from step review

- **WHEN** a session in the window prescribes endurance or recovery work only
- **THEN** it is excluded from step-level review, and contributes only to the window's aggregate distribution

#### Scenario: Endurance ceiling violation still surfaced

- **WHEN** an endurance session was delivered above the philosophy's endurance intensity ceiling
- **THEN** the violation is surfaced even though the session was excluded from step-level review

### Requirement: Review depth scales with the prescribed band

The coaching session SHALL vary review depth with how narrow the prescribed intensity band is, on the principle that the narrower the band, the more a delivery error changes which adaptation occurred.

#### Scenario: Maximal-aerobic work studied

- **WHEN** the reviewed session prescribed work at or above maximal aerobic power
- **THEN** the review reads it rep by rep, treating decay across reps as the primary finding rather than as a compliance detail

#### Scenario: Sweet spot and threshold scanned

- **WHEN** the reviewed session prescribed sweet spot or threshold work
- **THEN** the review reads it at rep level for shortfall and decay, but treats small deltas within the prescribed band as delivered

#### Scenario: Unstructured-by-nature sessions reviewed on distribution

- **WHEN** the reviewed session could not be executed against a structured workout — for example a track session, where no head unit is permitted and pacing comes from called splits
- **THEN** the review uses the intensity-distribution lens and the session's effort peaks, and does not report the absence of step alignment as a finding

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

### Requirement: Report the pattern across the window

The coaching session SHALL present findings as patterns across the reviewed window rather than as a per-session list, because a recurring shortfall is actionable where a single session's delta is not.

#### Scenario: Recurring shortfall surfaced

- **WHEN** the same shortfall appears in the same structural position across multiple reviewed sessions
- **THEN** the review reports it as a pattern with the sessions that evidence it, and proposes what would address it

#### Scenario: Isolated in-window shortfall withheld

- **WHEN** a single work-step shortfall appears once in the window and does not recur
- **THEN** it is not raised with the athlete, but is available if the athlete asks about that session

#### Scenario: Middle-band dose reported every window

- **WHEN** the review completes
- **THEN** the window's planned-versus-delivered middle-band dose is reported regardless of whether it met target, because that dose is the philosophy's load-bearing metric

#### Scenario: Delivered load contradicts the plan

- **WHEN** the window's delivered middle-band dose falls materially short of what was prescribed
- **THEN** the coach reports the gap explicitly before drafting further work, names the likely cause from the step-level findings, and does not quietly plan the next block on the assumption the last one landed

### Requirement: Review findings reach the coaching log as threads

The coaching session SHALL log review findings that pass the log's re-derivability test, recording the pattern rather than the individual verdicts.

#### Scenario: Pattern logged, verdicts not

- **WHEN** a review pattern is logged
- **THEN** the entry records the pattern, the sessions evidencing it, and the decision taken, and does not record per-step verdicts that are re-derivable from the platform

#### Scenario: Open thread carries forward

- **WHEN** a review pattern warrants watching beyond this session
- **THEN** it is opened as a thread in the log's live-state header with the condition that would close it, so the next review tests it explicitly
