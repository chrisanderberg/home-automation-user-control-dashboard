<!--
MANUAL.md — Source of Truth (Project-Independent)

How to use this file (for LLMs and humans):
- This document defines the canonical domain concepts, invariants, and intended
  interpretation of data for this family of projects.
- Treat this as the authoritative spec. Do not invent new rules that contradict
  it.
- If an implementation decision conflicts with this document, update this
  document first (or explicitly mark the point as TBD here), then implement.
- If something is marked TBD, keep it parameterized/configurable in code and do
  not hardcode a policy.

Scope:
- Project-independent concepts only (controls, models/responsibility, clocks,
  bucketing, counting rules, KDE/CTMC interpretation, data lifecycle intent).
- No framework-, database-, transport-, or deployment-specific APIs.

Output expectations when implementing from this spec:
- Prefer small, testable units with acceptance tests derived from invariants.
- Document any additional assumptions as TBD additions to this file.
-->

# Manual: Controls, Clocks, Measurement, and Inference

This document defines project-independent core concepts for implementing systems
that (1) expose user-adjustable controls, (2) attribute control behavior to
automation models, and (3) infer user preferences as a function of time using
multiple clock representations.

## Core invariants

- The system models user-adjustable home-automation settings as **controls**.
- Controls are limited to settings that can be explicitly inspected and changed
  (for example via a dashboard). Implicit signals such as motion detection are
  out of scope.
- Each control has an active automation model responsible for automation.
- Control state may be changed by the active automation model and by direct user
  action.
- Direct user action does not change which model is active. The model remains
  responsible for automation and may still change the state after a user action.
- Control state changes can originate from any client (dashboard UI, Node-RED,
  etc.) and are treated equivalently by the system.
- Time is analyzed by **time of week**, broken into **5-minute buckets**.
- Time-of-week bucketing is computed separately for each of the five clocks,
  producing five parallel time-of-week coordinate systems.
- Holding time is measured in real elapsed milliseconds and is split across all
  overlapped time-of-week buckets, per clock.
- When a clock’s time-of-day is undefined, data is not counted for that clock.
  When time-of-day becomes defined again, counting resumes.
- Only transitions initiated by a human user are recorded as transitions.
- Automated state changes performed by automation models are not recorded as
  transitions.
- If data integrity fails (e.g., missing/invalid timestamps, broken attribution,
  or other integrity failures), affected data is discarded rather than ingested.
- A seasonal retention scheme is used to preserve annual structure (rolling
  quarters Q1–Q4; retention/rollover details: TBD).

## Domain model

### Controls

This project models user-adjustable home-automation settings as **controls**.
Controls represent system state that can be set automatically by automation
models and can also be changed directly by the user through a UI or other client.

Controls are intentionally limited to settings the user can explicitly inspect
and change (for example via a dashboard), as opposed to implicit signals such as
motion detection, which are out of scope.

#### Control categories

##### 1) Discrete controls (radio buttons)

- A discrete control has a finite set of labeled options and is represented in
  the UI using radio buttons.
- Number of states: N, where 2 <= N <= 10.
- Examples:
  - On / Off (N = 2)
  - Mode: Off / Auto / Low / Medium / High (N = 5)
  - Scene selector with up to 10 scenes (N <= 10)

##### 2) Slider controls (6-state sliders)

- A slider control is represented in the UI as a continuous slider but is
  discretized into exactly 6 states for modeling and analytics.
- Number of states: N = 6:
  - State 0: minimum value (e.g., DIM)
  - States 1–4: transition states (quartiles)
  - State 5: maximum value (e.g., BRIGHT)

#### Common properties (all controls)

- Each control has a unique identifier (`controlId`).
- Each control has a finite set of discrete states.
- Each control has a current discrete state:
  - Discrete/radio controls: integer state in the range 0..N-1 (where 2 <= N <= 10)
  - Slider controls: integer state in the range 0..5
- Each control has an active automation model responsible for automation.
- Control state may be changed by:
  - the currently active automation model, and/or
  - a direct user action (manual intervention).
- Manual intervention does not change which model is active. The model remains
  responsible for automation and may still change the state after a user action.
- Control state changes can originate from any client (dashboard UI, Node-RED,
  etc.) and are treated equivalently by the system.

### Models and responsibility

Each control can be driven by one of multiple automation **models** over time.

- A **model** defines how the automated system would set or update the state of a
  control over time.
- At any given moment, exactly one model is considered the active automation
  model for a control.
- A user can manually change the control state at any time. The active model does
  not change when the user intervenes.
- The active model remains responsible for automation and may also change the
  state after a user action. However, transitions are only recorded when a human
  user is responsible for the state change.

## Time model

### The five clocks

#### Definitions

##### 1) Local time (statutory/civil time)

- The time shown by ordinary clocks in a given location: time defined by statute.
- It is tied to:
  - the chosen time zone (offset from UTC), and
  - daylight saving time rules (if applicable).
- Key property: it can jump (DST “spring forward” / “fall back”), and it is
  ultimately a social/legal convention rather than an astronomical one.

##### 2) UTC (Coordinated Universal Time)

- A global time standard used for coordination.
- It is a uniform 24-hour clock that runs independent of location and time zones.
- Key property: for everyday use it can be treated as continuous and monotonic
  compared to local time (it does not have DST jumps). It is the baseline time
  reference; local time is typically derived from UTC by applying offsets/rules.

##### 3) Mean solar time

- A 24-hour clock synchronized to the Sun’s average (mean) position for a given
  location.
- Historically, this is the kind of local clock time used before standardized
  time zones: a location-specific solar-based clock rather than a time-zone-based
  one.
- Key property: depends on longitude (east/west position). Two towns at different
  longitudes have different mean solar times even if they share a legal time zone.

##### 4) Apparent solar time

- Solar time based on the Sun’s actual apparent position in the sky, not the
  averaged one.
- Historically, this is what an actual sundial yields, and it is also close to
  how pre-standardization local clocks aimed to behave (before uniform time
  zones were a thing).
- Key property: differs from mean solar time by the equation of time (a seasonal
  varying offset) caused by Earth’s axial tilt and orbital eccentricity. This
  makes apparent solar time run “fast” or “slow” relative to mean solar time
  depending on the date.

Relationship to (3):

- Apparent solar time = mean solar time + (equation of time adjustment)

##### 5) Unequal hours (temporal hours)

- A clock where the “hours” are not fixed-length minutes.
- Definition:
  - 6:00 a.m. is always sunrise
  - 6:00 p.m. is always sunset
- That implies:
  - The daylight interval (sunrise→sunset) is always mapped to 12 equal “day
    hours”.
  - The night interval (sunset→next sunrise) is mapped to 12 equal “night hours”.
- Key property: the length of an “hour” changes throughout the year (and by
  latitude), because day length changes. So “1 temporal hour” might be longer
  than 60 minutes in summer daytime and shorter than 60 minutes in winter daytime
  (with the opposite effect at night).

#### Utility

##### 1) Local time (statutory/civil time) — why it’s useful

Local time is useful because it matches how people schedule their lives.

- Human coordination: work hours, school schedules, meal times, bedtime routines,
  and “evening” habits are usually anchored to local time (“at 7:30 PM dim the
  lights”), not to UTC.
- UI and expectations: a dashboard showing “Monday 18:00–18:05” is naturally
  interpreted in local time.
- Behavioral signal: strong preference patterns by local time suggest preferences
  driven by social routine more than sunlight.
- Practical automation alignment: many existing automations and integrations
  reference local time.

##### 2) UTC — why it’s useful

UTC is useful because it is stable, comparable, and unambiguous.

- No DST ambiguity: local time can repeat or skip intervals around DST. UTC
  avoids these discontinuities, which is useful for measuring durations and
  ordering events.
- Consistency across systems: many devices and APIs represent timestamps in UTC.
- Debugging and reproducibility: UTC is a simple reference clock for reconstructing
  event sequences.
- Baseline comparison: comparing UTC vs local-time patterns can help identify
  schedule-driven vs clock-driven effects.

##### 3) Mean solar time — why it’s useful

Mean solar time is useful because it aligns with the Sun’s average daily rhythm,
but stays smooth and predictable.

- Longitude-corrected “solar day”: locations within the same time zone can differ
  in sunrise/sunset timing; mean solar time accounts for longitude.
- Season robustness vs statutory time: mean solar time tracks average solar
  motion rather than political time boundaries.
- Stable solar reference: apparent solar time varies relative to mean solar time
  due to the equation of time; mean solar time removes that variation.
- Good for smoothing/generalization: can provide a stable sun-aligned schedule
  representation across seasons.

##### 4) Apparent solar time — why it’s useful

Apparent solar time is useful because it correlates with the Sun’s actual
position, which often relates to ambient light conditions.

- Perceptual alignment: indoor lighting preferences respond to ambient daylight;
  apparent solar time tracks the true solar position.
- Captures seasonal irregularity: includes equation-of-time variation.
- Better fit for “solar noon” behaviors: some behaviors correlate more with the
  Sun’s highest point than with a civil clock.
- Diagnostic value: comparing mean vs apparent can reveal whether the
  equation-of-time offset matters for preferences.

##### 5) Unequal hours (temporal hours) — why it’s useful

Unequal hours are useful because they normalize the day around sunrise and
sunset so that schedules remain seasonally consistent.

- Seasonal invariance: a schedule keyed to sunset does not drift across seasons.
- Natural framing: “after sunrise” / “before sunset” routines map naturally.
- Better generalization: adapts to seasonal day-length changes.
- Interpretability for automation: rules can express “late afternoon” in a way
  that is robust across seasons.

### Time-of-week bucketing (per clock)

Time is analyzed by time of week, broken into 5-minute buckets.

- Each day has 24 hours × 12 buckets/hour = 288 buckets.
- Each week has 7 days × 288 buckets/day = 2,016 buckets.
- Each bucket corresponds to a time-of-week label such as:
  - Monday 00:00–00:05
  - Monday 00:05–00:10
  - ...
  - Sunday 23:55–24:00

This bucketing is computed separately for each of the five clocks, producing
five parallel time-of-week coordinate systems.

#### Time-of-day view (derived from time-of-week)

In addition to time-of-week, analytics can be viewed by time of day.

This is computed on demand by aggregating time-of-week buckets across days:

- A time-of-day bucket corresponds to the same 5-minute position within the day.
- For a given time-of-day bucket, sum the corresponding 7 time-of-week buckets
  (one from each day of the week).

This produces a time-of-day profile without requiring separate storage.

#### Bucket boundaries and irregular mappings

All clocks use the same bucket labels (5 minutes × 2016/week), but the mapping
from real timestamps into those labels differs by clock:

- UTC: buckets are uniform and continuous.
- Local time: buckets are 5-minute labels, but DST can create discontinuities:
  - when clocks move forward, some local-time labels do not occur,
  - when clocks move backward, some local-time labels occur twice.
  Real timestamps remain unambiguous; the local-time mapping can repeat or skip
  labels while still using 5-minute buckets.
- Mean solar time: buckets are 5-minute labels in mean solar time, derived from
  longitude.
- Apparent solar time: buckets are 5-minute labels in apparent solar time. The
  equation-of-time adjustment varies across the year, so bucket boundaries drift
  relative to UTC/local time.
- Unequal hours: bucket labels represent “5 minutes” of unequal-hour time (1/12
  of an hour on that clock), so real elapsed time per bucket varies with date and
  latitude.

#### Undefined time-of-day cases (solar clocks)

Some solar-clock mappings can become undefined in special geographic/seasonal
cases:

- Unequal hours requires both a sunrise and sunset. When the sun does not rise or
  does not set (e.g., polar day/night at some latitudes and seasons), unequal-hours
  time-of-day is considered undefined.
- At exactly the poles, mean solar time and apparent solar time can also be
  treated as undefined.

When a clock’s time-of-day is undefined, data is not counted for that clock.
When the time-of-day becomes defined again (e.g., the season changes and sunrise
and sunset return), counting resumes.

#### Splitting holding intervals across buckets

Holding time is recorded in real elapsed milliseconds and is split across all
time-of-week buckets it overlaps, per clock.

Concretely, if the control remains in state `s` over a real-time interval
`[t0, t1)`, then for each clock:

- Determine which time-of-week buckets are overlapped by `[t0, t1)` under that
  clock’s mapping.
- Split the interval at the bucket boundaries and allocate elapsed milliseconds
  into each overlapped bucket’s holding-time counters.

This applies to all clocks, including local time during DST transitions and the
variable-length buckets of unequal hours.

### Clocks as an experiment (schedule A/B test)

The five clocks are five alternative time-of-week coordinate systems. Measuring
against all five is an experiment to determine which representation best
correlates with inferred user preference. (Evaluation objective/metric: TBD.)

- Local time → social schedule view
- UTC → stable baseline / instrumentation view
- Mean solar → average sun-aligned view
- Apparent solar → true sun-position view
- Unequal hours → sunrise/sunset anchored view

By computing CTMC stationary preferences against each clock’s week-buckets, the
clock representation that best explains and predicts interventions can be
compared without assuming in advance that any particular clock is the correct
reference.

## Measurement model

### Fundamental data operations

There are two fundamental types of data operations in the analytics system:

1) Count holding times
- Input: start timestamp, end timestamp, and the held state.
- Interpretation: the control remained in a given state over a time window.
- For each clock, the holding interval is mapped onto time-of-week buckets and
  the elapsed milliseconds are split across all buckets the interval overlaps.
- This operation uses two timestamps and one state.

2) Count user-initiated transitions
- Input: a timestamp, a start state, and an end state.
- Interpretation: a human user changed the control from one state to another at
  an instant in time.
- For each clock, the timestamp is mapped to the time-of-week bucket containing
  that timestamp, and the transition count for that bucket is incremented.
- This operation uses one timestamp and two states.

### Client behavior vs. analytics operations

Clients do not operate directly in terms of the two fundamental analytics
operations. Instead, clients simply request or cause a state change (from one
state to another), and the system derives the analytics updates.

Typical state-change handling logic maintains, per control, the last known state
and the timestamp when that state began (i.e., when the last state change
occurred). When a new state change occurs:

1) The holding interval for the previous state is computed:
- start = previous change timestamp
- end = current change timestamp
- state = previous state
Holding time is recorded for that interval (split across buckets for each clock).

2) If and only if the change was initiated by a human user, a transition event is
recorded at the current timestamp (for each clock, in the containing bucket).

Automated model-driven state changes update holding times (by closing the
previous holding interval) but do not generate recorded transitions.

### What is counted (per control, per model, per clock, per bucket)

For each control and each 5-minute bucket (for each clock), the system records
two categories of statistics keyed by model:

1) Time spent in each state (holding time)
- Measured in milliseconds.
- Accrued continuously while the model is active, regardless of whether the state
  was most recently set by the model or by the user.
- Holding time is split across all time-of-week buckets the holding interval
  overlaps (per clock).
- For a control with N discrete states:
  - `holdMs[model][s]` accumulates time spent in state `s` attributed to `model`
    while that bucket is active (under that clock).

2) User-initiated transitions between states
- Measured as counts (frequencies).
- Only transitions initiated by a human user are recorded.
- Automated state changes performed by the model are not recorded as transitions.
- A user-initiated transition is counted in the time-of-week bucket that contains
  the transition timestamp (per clock). (Definition of “user-initiated”: TBD.)
- For a control with N discrete states:
  - `transCount[model][i][j]` accumulates user-initiated transitions from state
    `i` to state `j` attributed to `model` while that bucket is active (under that
    clock).

### Aggregating models to get control-wide analytics

To view analytics for the control as a whole (across all models), aggregate by
summing across models:

- `controlHoldMs[s] = sum over models of holdMs[model][s]`
- `controlTransCount[i][j] = sum over models of transCount[model][i][j]`

This produces a combined dataset for the control that reflects the full mixture
of model activity over time.

## Inference model

### Core hypothesis (models vs user preference)

Core hypothesis:

- Total time-in-state (holding time) largely reflects what the automation model
  is doing (its behavior/policy), in the sense that it reflects what the system
  actually did while that model was active/responsible.
- The stationary distribution of the inferred CTMC is intended to reflect what
  the user actually prefers during that time-of-week bucket, because it is
  informed by user correction dynamics rather than just occupancy.

If this hypothesis holds, then:

- Different models for the same control may show different raw holding-time
  profiles (because the models behave differently).
- But after fitting a CTMC and computing its stationary distribution, the
  resulting preference distribution should converge toward the same underlying
  user preference across all models of the same control.

Importantly, this convergence expectation applies within each clock’s bucketed
view. For a given control and a given (clock, bucket), the stationary
distributions computed from different models’ data should tend to agree.

### Kernel density estimation (temporal smoothing)

Individual 5-minute time-of-week buckets may contain limited data, especially
early on or for infrequently adjusted controls. To address this, analytics do
not rely solely on raw per-bucket counts. Instead, kernel density estimation
(KDE) is used to smooth statistics across neighboring time buckets.

KDE is applied along the time-of-week axis, independently for each clock, control,
and model.

#### Why KDE is used

KDE serves two related purposes:

1) Statistical robustness
- Adjacent time buckets are likely to reflect similar user preferences.
- Smoothing across neighboring buckets reduces noise and avoids overfitting to
  sparse data in any single bucket.
- This is especially important when user-initiated transitions are rare.

2) Continuous-time estimation
- Although data is stored in discrete 5-minute buckets, preference is not
  inherently discrete.
- KDE allows estimation at arbitrary times, including exact clock times (e.g.,
  03:00) and moments near bucket boundaries.

In effect, KDE treats time-of-week as a continuous cyclic variable rather than a
strictly discrete one.

#### Sparse data handling (TBD)

How sparse data is handled is a design choice. Options include:

- Using a kernel with nonzero weight over the full weekly cycle (e.g., a Gaussian
  distribution conceptually extends infinitely), so every bucket has some weight,
  even if extremely small.
- Using a damping/regularization approach analogous to PageRank (a small baseline
  mass or prior), to avoid degenerate estimates when transitions are rare.

Exact KDE bandwidth and damping behavior are TBD.

#### How KDE is applied conceptually

For a given query time-of-week (under a given clock):

- A set of buckets around the query time contributes to the estimate.
- Each bucket’s contribution is weighted by a kernel function (for example,
  Gaussian), based on temporal distance from the query time.
- Holding times and transition counts are combined using these weights to form
  smoothed estimates of:
  - state holding times, and
  - user-initiated transition counts.

The result is a smoothed set of sufficient statistics that can be used to build
a CTMC corresponding to that specific time-of-week.

#### Cyclic nature of time-of-week

Time-of-week is inherently cyclic:

- Sunday night transitions into Monday morning.
- KDE wraps across the start/end of the week so that buckets near the boundary
  are treated as neighbors.

This prevents edge effects near week boundaries.

#### Relationship to CTMC estimation

KDE is applied before fitting the CTMC:

- Smoothed holding times and transition counts are computed using KDE.
- These smoothed quantities are used to construct the CTMC generator.
- The stationary distribution is computed from this smoothed CTMC.

### CTMC model (per model and aggregated)

Within each (clock, bucket), the control is modeled as a continuous time Markov
chain (CTMC) whose states are the control’s discrete states.

The CTMC can be fit and analyzed at two levels:

1) Per-model CTMC
- Built from that model’s holding times and user-initiated transition counts.
- Used to understand model behavior and user correction patterns while that model
  is active.

2) Aggregated CTMC (control-wide)
- Built from the sum of all models’ data for the control.
- Used to estimate overall user preference during that (clock, bucket).

### Why the stationary distribution matters (and per-model convergence)

For each (clock, bucket), the CTMC has a stationary distribution: a vector of
probabilities over states representing the long-run fraction of time the process
would spend in each state if the observed correction dynamics remained consistent.

This stationary distribution is treated as the estimate of the underlying user
preference during that time-of-week bucket because it accounts for both:

- how long the system tends to remain in each state (holding time), and
- how often the user corrects the system by transitioning between states.

Key expectation:

- Raw holding times may differ by model.
- Stationary distributions computed per model should tend to agree with each
  other within a given (clock, bucket), and should also agree with the stationary
  distribution computed from aggregated data.

## Data lifecycle

### Data quality (discarding bad data)

If something goes wrong (e.g., missing/invalid timestamps, broken attribution,
or other integrity failures), the affected data is discarded rather than ingested
into the aggregates.

### Accumulation model (rolling quarters)

Because some clock effects require a full year to observe (e.g., mean vs apparent
solar differences, and DST vs non-DST patterns), the system preserves seasonal
variation rather than using a simple exponential decay.

Planned approach:

- Rolling windows with 4 quarters per year (Q1–Q4) so analyses can compare seasons
  and clocks without requiring an always-growing lifetime dataset.

Exact retention/rollover details are TBD.

## Concrete example (attribution and counting)

Example scenario (single control, single active model):

- Control: 6-state slider (states 0..5).
- Active model: “Unequal-hours sunset schedule.”
- The model sets the control to state 5 earlier in the day.
- At 18:02, the user changes the state from 5 to 2.

Counting behavior:

- The holding interval before the user action is recorded as elapsed milliseconds
  in state 5 and is split across all overlapped buckets (per clock).
- The state change at 18:02 is counted as a user-initiated transition 5 -> 2 in
  the bucket containing 18:02 (per clock).
- All holding time and the user transition are attributed to the active model
  (since the model remains active before and after the user action).