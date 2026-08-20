## Purpose

Answers "what would this week do to my fitness, fatigue and form?" before anything is written to the calendar, by deriving each proposed session's load from its own prescription and carrying the fitness/fatigue model forward from the athlete's delivered state — so a build week can be checked against its ramp target while it is still a draft.

## ADDED Requirements

### Requirement: Derive a session's load from its prescription

The system SHALL derive a proposed session's training load from the session's own prescribed steps, reproducing the platform's derivation so the forecast previews the figure the platform will show once the session is written.

#### Scenario: Session given as workout text

- **WHEN** a proposed session carries a workout description
- **THEN** its load is derived from that description's steps at the forecast's stated threshold

#### Scenario: Step prescribing a range

- **WHEN** a step prescribes a range of power and is not marked as a ramp
- **THEN** the range contributes at its midpoint, matching the platform's own treatment

#### Scenario: Step prescribing a ramp

- **WHEN** a step is marked as a ramp
- **THEN** it contributes as a progression across its prescribed range rather than at a single wattage

#### Scenario: Session whose steps cannot be resolved to watts

- **WHEN** a proposed session's prescription cannot be resolved to absolute watts
- **THEN** the session is reported as underivable and contributes no load, rather than being assigned an estimated figure

### Requirement: Seed the trajectory from delivered state

The system SHALL seed the fitness and fatigue trajectory from what the athlete has actually delivered as at the seed date, and SHALL carry it forward across the forecast window under the athlete's own time constants.

#### Scenario: Seed date carries both delivered and planned work

- **WHEN** the seed date has both a completed activity and a planned session
- **THEN** the seed is taken from the delivered state, not from the platform's projection onto the planned session

#### Scenario: Caller supplies a starting state

- **WHEN** a starting fitness and fatigue are supplied directly
- **THEN** those are used as the seed and the result states that they were supplied rather than read

#### Scenario: Ramp reported for the first forecast day

- **WHEN** a forecast day's ramp is reported
- **THEN** it is measured against the fitness of seven days earlier, drawing on delivered history where the window reaches behind the seed date

### Requirement: Forecast over already-planned work

The system SHALL read the work already planned in the forecast window and treat the proposed sessions as an overlay on it, so a partly-fixed week can be forecast without restating the sessions that are already fixed.

#### Scenario: Date with planned work and no proposed session

- **WHEN** a date in the window carries a planned session and none is proposed for it
- **THEN** the planned session's load contributes to the trajectory

#### Scenario: Date with both

- **WHEN** a proposed session is supplied for a date that already carries planned work
- **THEN** the proposed session replaces the planned work for that date

#### Scenario: Planned session already carrying a platform-computed load

- **WHEN** a planned session in the window already carries a load computed by the platform
- **THEN** that figure is used rather than re-derived, keeping the forecast anchored to what the athlete's dashboard shows

### Requirement: Report each session's load source

The system SHALL report, for every session contributing to the forecast, where its load came from — derived from a locally parsed prescription, supplied by the platform on an already-written session, or supplied directly by the caller.

#### Scenario: Mixed sources in one forecast

- **WHEN** a forecast combines a written session, a drafted prescription, and a session given only as a load figure
- **THEN** each session's source is stated individually, because a forecast mixing sources is the normal case rather than an exception

### Requirement: Report the trajectory by day and roll it up by week

The system SHALL report fitness, fatigue and form for each day of the window, and SHALL roll each week up to its total load, its duration, and its fitness ramp, because the ramp over a week is the figure a block plan is judged against.

#### Scenario: Day-by-day trajectory

- **WHEN** a forecast is returned
- **THEN** each day in the window carries its load, fitness, fatigue and form

#### Scenario: Weekly roll-up

- **WHEN** a forecast spans one or more weeks
- **THEN** each week carries its total load, its total duration, and the change in fitness across it

### Requirement: Exclude what the platform excludes

The system SHALL exclude from the load model exactly what Intervals.icu excludes from its own projection, and SHALL say so, rather than diverging from the athlete's dashboard by modelling load the platform does not model.

#### Scenario: Strength session in the window

- **WHEN** the window contains a strength session
- **THEN** it contributes no load, matching the platform, and the result states that strength is unmodelled so the forecast is not read as a complete account of fatigue

### Requirement: State the basis of the forecast

The system SHALL state the threshold, the fitness and fatigue time constants, and the seed date and its origin alongside every forecast.

#### Scenario: Basis reported with the result

- **WHEN** a forecast is returned
- **THEN** it names the threshold it resolved targets against, the time constants it carried the model forward under, and the seed it started from

### Requirement: Forecast without writing

The system SHALL produce a forecast without creating, modifying or deleting anything on Intervals.icu.

#### Scenario: Forecasting a draft week

- **WHEN** a week of proposed sessions is forecast
- **THEN** no event is written to the calendar, so a draft can be iterated on freely before anything is committed
