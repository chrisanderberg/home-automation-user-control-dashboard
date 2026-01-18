<!--
docs/plans/IMPLEMENTATION_PLAN.md

This plan is project-specific and milestone-based. It must not redefine core
domain semantics from docs/context/MANUAL.md.

Execution rule for coding agents:
- Implement exactly one milestone at a time.
- Do not implement future milestones unless explicitly requested.
- If a milestone requires a spec decision that MANUAL.md marks TBD or omits,
  expose it as configuration and proceed, OR stop and request the missing
  decision (do not guess).
-->

## Change control (applies during implementation)

This plan is a living document, but `docs/context/MANUAL.md` is the source of
truth for domain semantics.

If implementation work reveals that the plan or checklist needs to change:
1) STOP and ask the human to approve the proposed change (do not change docs
   unilaterally).
2) After approval, update the relevant doc(s):
   - `docs/plans/IMPLEMENTATION_PLAN.md`
   - `docs/plans/IMPLEMENTATION_CHECKLIST.md`
   - `docs/context/MANUAL.md` (only if domain semantics change)
3) Append a short entry to `docs/plans/CHANGES.md` describing what changed and
   which milestones are affected.

Non-goal:
- Do not “paper over” missing decisions by inventing new rules. If something is
  TBD, keep it configurable or ask for a decision.

# Implementation Plan — Local Home Controls Dashboard + Multi-Clock Inference

## 0) Scope, Assumptions, and Principles

### Scope (what we are building)
A local-network hobby system that:
- models user-adjustable home-automation **controls**
- attributes behavior to an active automation **model** per control
- measures behavior by **time of week** in **5-minute buckets**
- computes analytics under **five clocks** in parallel:
  - Local time, UTC, Mean solar, Apparent solar, Unequal hours
- counts:
  - holding time (ms), split across overlapped time-of-week buckets per clock
  - user-initiated transitions (counts), bucketed per clock
- performs inference:
  - KDE smoothing over time-of-week (cyclic) to estimate statistics at *specific
    times* (e.g., “noon exactly”)
  - CTMC stationary distributions as preference estimates

Authoritative spec: `docs/context/MANUAL.md`

### Deployment assumptions (project-specific)
- Runs on a single machine or local network.
- Development-style runtime is acceptable (Convex + web dev server).
- No public hosting requirements.
- Minimal/no auth (local-only).

### Tech defaults (project-specific)
- TypeScript throughout
- Monorepo with shared core logic
- Backend/data sync: Convex (local dev)
- Frontend later: TanStack Start
- Schema validation: Zod (where needed)
- Styling/UI: Tailwind + shadcn/ui optional (later)

### Key policy choices fixed by this project (not TBD)
- “User-initiated” is provided explicitly by clients on each change:
  - `initiator: "user" | "model"`
- Single global location for solar clocks:
  - `(latitude, longitude)` stored in Convex; configurable via API now, UI later
- Persist data locally using Convex (no repository abstraction layer)
- Analytics query APIs return **all clocks** in one response (clock comparisons are core).
  - Queries may accept an optional `modelId`.
  - Queries do *not* accept `clockId` as an input.
- **Debounced analytics transitions**:
  - For both radiobuttons and sliders, analytics transitions are recorded only
    for **committed** changes (the “final settled” value), not intermediate UI
    adjustments.
  - Intermediate changes may still update the control’s current value for
    multi-client synchronization, but do not generate analytics events.

### Control surface vs analytics state (important separation)
- Analytics operates on **discrete states**:
  - radiobutton: integer in `0..N-1`
  - slider: integer in `0..5` (exactly 6 states)
- Slider control surface (UI + syncing) is **continuous**:
  - a `value01` in \([0,1]\) that clients perceive and exchange
- For sliders:
  - `value01` is the canonical “current value” stored in runtime
  - discrete analytics state is derived from `value01`
- MANUAL.md requires a “current discrete state”; for sliders we satisfy this by
  storing the derived discrete state alongside the continuous value.

### Storage vs. Display/Inference (important separation)
- The system **stores** measurements in **5-minute time-of-week buckets** (per clock).
- The dashboard/user experience generally wants “preference at a specific time”
  (e.g., “noon exactly”), not “what happened during 12:00–12:05”.
- Therefore, the “display-ready” pipeline is:
  1) read raw bucketed aggregates
  2) apply KDE over cyclic time-of-week to estimate sufficient statistics at an
     arbitrary query time (per clock)
  3) build CTMC and compute stationary distribution (with Markov damping if enabled)
  4) return results for **all clocks** together
- Raw bucketed aggregates remain useful primarily for debugging/export.

### Configuration knobs (must remain configurable due to MANUAL TBDs/omissions)
These must be stored in Convex config and/or passed through APIs:
- KDE bandwidth \(h\) (TBD in MANUAL)
- KDE kernel choice / effective window (optional; keep simple but configurable)
- Markov/CTMC damping (teleportation) to ensure ergodicity / stable stationary
  distribution under sparse/disconnected observations (TBD; configurable)
  - Example discrete form: \(P' = \alpha P + (1-\alpha)\mathbf{1}v^\top\)
- Clock evaluation objective/metric (TBD in MANUAL)
- Retention/rollover details for rolling quarters Q1–Q4 (TBD in MANUAL)

Additionally, MANUAL describes CTMC construction conceptually but does not fix a
specific estimator for generator rates. We must not guess silently.
- CTMC rate estimation rule MUST be:
  - specified in MANUAL.md (preferred), OR
  - implemented as an explicit configurable policy with a documented default

Slider discretization boundary rounding is not fully decided:
- Slider thresholds are fixed (quartiles), but exact behavior at 0.25, 0.5, 0.75
  is TBD and must be configurable.

### Non-goals (for this implementation plan)
- Production hosting, scaling, CI/CD
- Advanced auth, multi-tenant security
- Mobile native apps
- Implicit signals (e.g., motion detection)

---

## 1) Proposed Repository Layout

- `apps/web/`
  - TanStack Start web app (UI deferred until later milestones)
- `packages/core/`
  - Pure, framework-agnostic logic:
    - domain types
    - time bucketing
    - clock mappings
    - holding-interval splitting
    - KDE + CTMC inference utilities
  - No Convex imports
- `convex/`
  - Convex schema, mutations, queries
  - Uses `packages/core` for shared types/logic where feasible
- `docs/context/MANUAL.md`
- `docs/plans/IMPLEMENTATION_PLAN.md` (this file)

---

# Milestones

## Milestone 1 — Monorepo Scaffold + Local Dev Runtime

### Goal
A runnable monorepo with Convex and a placeholder web app, plus a working test
runner. Establish shared TypeScript builds and import paths.

### Deliverables
- Monorepo scaffolding (pnpm recommended)
- `packages/core` package created and buildable
- `apps/web` created (TanStack Start initialized but UI work deferred)
- Convex project initialized in `convex/`
- Test setup (Vitest recommended) targeting `packages/core`

### Inputs and Outputs
- Inputs: none
- Outputs:
  - `pnpm dev` starts local dev processes (Convex + web dev server)
  - `pnpm test` runs unit tests (initial smoke test)

### Non-goals
- No domain/business logic correctness yet
- No UI features
- No analytics or inference

### Acceptance criteria
- Commands:
  - `pnpm install`
  - `pnpm test` succeeds
  - `pnpm dev` starts without runtime errors
- A trivial unit test runs (e.g., sanity test in `packages/core`)

### Edge cases
- Covered: none (scaffold only)
- Deferred: environment-specific setup differences

---

## Milestone 2 — Domain Model Types + Validation (Controls, States, Slider Mapping)

### Goal
Implement canonical domain types and validation rules from MANUAL.md, using
project-friendly names (“radiobutton” and “slider”), plus slider discretization
rules (with TBD boundary rounding).

### Deliverables
In `packages/core/domain/`:

#### Control types
- Types:
  - `ControlId`, `ModelId`
  - `ControlKind = "radiobutton" | "slider"`
  - `ControlDefinition`
    - radiobutton: `2 <= N <= 10` plus labels
    - slider: exactly 6 discrete analytics states (0..5), plus optional UI metadata

#### Discrete state types (analytics-facing)
- `DiscreteState`:
  - radiobutton: integer in `0..N-1`
  - slider: integer in `0..5`

#### Slider continuous value types (control-surface-facing)
- `SliderValue01`:
  - number in \([0,1]\)

#### Slider discretization (continuous → discrete) with fixed thresholds
Implement a function (in core) to map `value01` to a discrete state 0..5:
- 0 → state 0
- 1 → state 5
- \(0 < x < 0.25\) → state 1
- \(0.25 < x < 0.5\) → state 2
- \(0.5 < x < 0.75\) → state 3
- \(0.75 < x < 1\) → state 4

Boundary behavior is TBD:
- Exactly at 0.25, 0.5, 0.75:
  - do not assume a rounding rule silently
  - expose a config/policy, e.g.:
    - “round down”
    - “round up”
    - “nearest, ties up”
  - store this policy in Convex config later (Milestone 6)

#### Zod schemas
- Validate control definitions
- Validate:
  - discrete states given a control definition
  - slider `value01` in \([0,1]\)

#### API input shapes (used later by Convex mutations)
Define a discriminated union for “set value” requests:
- common fields:
  - `controlId`
  - `initiator: "user" | "model"`
  - `isCommitted: boolean` (debounced analytics; see Milestone 7/8)
- radiobutton payload:
  - `kind: "radiobutton"`
  - `newState` (discrete)
- slider payload:
  - `kind: "slider"`
  - `newValue01` (continuous)

Note:
- Server attaches timestamps and active model attribution.
- For sliders, server derives discrete states from continuous values for analytics.

### Inputs and Outputs
- Inputs: raw JSON payloads (future Convex mutation args)
- Outputs: validated objects or validation errors (to be discarded later per MANUAL)

### Non-goals
- No clocks or time bucketing
- No persistence or Convex code
- No inference

### Acceptance criteria
- Unit tests verifying:
  - Radiobutton control with N < 2 or N > 10 is rejected
  - Slider value01 rejects values < 0 or > 1
  - Slider discretization matches:
    - 0 → 0, 1 → 5
    - values strictly inside quartile bands map to expected states
  - Boundary values 0.25/0.5/0.75 require an explicit rounding policy (test that
    the function requires/configures this rather than silently deciding)

### Edge cases
- Covered:
  - Invalid N / invalid state ranges / invalid slider value range
- Deferred:
  - UI labels/units (can be extended later)
  - Exact default rounding policy (must be configurable)

---

## Milestone 3 — Bucket Indexing Utilities (2016/week + Cyclic Helpers)

### Goal
Implement clock-agnostic time-of-week bucket indexing and cyclic distance logic,
per MANUAL.md (288/day, 2016/week, 5-minute buckets).

### Deliverables
In `packages/core/time/`:
- Constants:
  - `BUCKET_MINUTES = 5`
  - `BUCKETS_PER_DAY = 288`
  - `BUCKETS_PER_WEEK = 2016`
- Utilities:
  - Convert (dayOfWeek, minutesIntoDay) → `bucketId`
  - Convert `bucketId` → (dayOfWeek, startMinute, endMinute)
  - Cyclic distance on bucket indices (wrap Sunday→Monday)
  - Helper to aggregate time-of-day view by summing 7 corresponding buckets

### Inputs and Outputs
- Inputs: indices/day/time values
- Outputs: deterministic bucket ids and labels

### Non-goals
- No mapping from real timestamps to buckets
- No DST/solar behavior yet

### Acceptance criteria
- Unit tests verifying:
  - Total buckets/week is 2016
  - `bucketId` range is [0, 2015]
  - Boundary mapping: Monday 00:00 → 0; Sunday 23:55 → 2015
  - Cyclic distance treats Sunday end as adjacent to Monday start

### Edge cases
- Covered:
  - Week wrap
- Deferred:
  - Localization of day labels (UI concern)

---

## Milestone 4 — Five Clocks: Timestamp → BucketId | undefined

### Goal
Implement mapping from real timestamps to time-of-week bucket ids for each of the
five clocks described in MANUAL.md, including undefined cases for solar clocks.

### Deliverables
In `packages/core/clocks/`:
- Shared types:
  - `ClockId = "local" | "utc" | "meanSolar" | "apparentSolar" | "unequalHours"`
  - `ClockConfig`:
    - `timezone` (IANA string for local time mapping)
    - `latitude`, `longitude` (global)
- Interface:
  - `mapTimestampToBucket(clockId, tsMs, config) -> bucketId | undefined`
- Implementations:
  - UTC clock mapping
  - Local clock mapping (DST-safe)
  - Mean solar mapping (longitude-based; undefined at poles per MANUAL allowance)
  - Apparent solar mapping (mean solar + equation of time; undefined at poles)
  - Unequal hours mapping:
    - requires sunrise & sunset
    - returns `undefined` when sun does not rise/set (polar day/night)

Implementation note (allowed):
- Use a well-known astronomy library (e.g., suncalc or equivalent) for sunrise,
  sunset, and equation-of-time computations, as long as behavior matches MANUAL
  invariants (and undefined cases are honored).

### Inputs and Outputs
- Inputs: `tsMs`, `ClockConfig`
- Output: bucket id or `undefined`

### Non-goals
- No interval splitting yet
- No persistence or analytics

### Acceptance criteria
- Unit tests verifying:
  - For a fixed timestamp and config, each clock returns a deterministic bucket id
  - Local clock handles DST transitions without throwing
  - Unequal-hours returns `undefined` when sunrise/sunset is missing (test can use
    extreme latitude + date known for polar day/night)
  - Mean/apparent can be treated `undefined` at the poles (explicit test case)

### Edge cases
- Covered:
  - DST skip/repeat does not break mapping
  - Undefined solar times correctly return `undefined`
- Deferred:
  - “Perfect” astronomical accuracy beyond reasonable library correctness

---

## Milestone 5 — Holding Interval Splitting Across Buckets (Per Clock)

### Goal
Implement correct splitting of real elapsed holding intervals \([t0, t1)\) into
per-bucket elapsed milliseconds, for each clock independently, per MANUAL.md.

### Deliverables
In `packages/core/measurement/splitHoldInterval/`:
- Function:
  - `splitHoldInterval({ t0Ms, t1Ms, clockId, config }) -> Map<bucketId, ms>`
- Rules enforced:
  - split by bucket boundaries under that clock’s mapping
  - allocate real elapsed ms into all overlapped buckets
  - if clock mapping is `undefined` for a segment, do not count that segment for
    that clock (MANUAL: “When time-of-day is undefined, data is not counted.”)
  - week wrap handled

### Inputs and Outputs
- Inputs: start/end timestamps, clock id, config
- Outputs: bucket→ms allocations for that clock

### Non-goals
- No transition counting
- No Convex ingestion
- No performance optimization beyond correctness

### Acceptance criteria
- Unit tests verifying:
  - Single-bucket interval allocates all ms to exactly one bucket
  - Multi-bucket interval allocates ms across multiple buckets and sum equals
    `t1Ms - t0Ms` (for defined mapping)
  - Interval crossing Sunday→Monday wraps correctly
  - If clock is undefined for that interval (or part of it), allocations omit
    undefined portions

### Edge cases
- Covered:
  - DST boundary intervals (local)
  - Variable bucket lengths (unequal hours)
- Deferred:
  - Very long intervals (days/weeks) performance tuning

---

## Milestone 6 — Convex Schema: Config, Controls, Runtime State, Event Log, Aggregates

### Goal
Create the Convex database schema needed to store:
- global config (timezone, latitude, longitude, inference params)
- controls definitions
- per-control runtime state (including slider continuous value)
- append-only *committed* change event log (for debounced analytics)
- measurement aggregates (holdMs and transCounts)

### Deliverables
In `convex/schema.ts` (and related files):

#### Tables (suggested names/fields; adjust as needed)
1) `config` (singleton)
- `timezone`, `latitude`, `longitude`
- KDE parameters:
  - `kdeBandwidth` (configurable; TBD default)
  - `kdeKernel` (optional; e.g., "gaussian")
- Slider discretization boundary policy (TBD):
  - `sliderBoundaryPolicy` (e.g., "roundDown" | "roundUp" | "tiesToX")
- Markov/CTMC stationary-distribution stability parameters:
  - `markovDampingAlpha` (configurable; TBD default)
  - `markovTeleportPrior` (configurable; e.g., "uniform" or explicit vector \(v\))
- CTMC estimator configuration (see Milestone 11 spec decision gate)
- retention config placeholder for quarters (TBD)

2) `controls`
- `controlId` (unique)
- `definition` (serialized; validated against core domain types)

3) `controlRuntime`
For all controls:
- `controlId`
- `kind: "radiobutton" | "slider"`
- `activeModelId`
- `currentDiscreteState` (always present; required by MANUAL)
- `lastUpdatedAtMs` (server time; when current value last changed)

For sliders only (kind = "slider"):
- `currentValue01` (continuous, canonical for slider runtime)

Analytics-commit tracking (for debounced analytics):
- `lastCommittedAtMs` (server time)
- `lastCommittedDiscreteState` (discrete state used for holds/transitions)

Notes:
- “current” may change frequently; “committed” changes are what drive analytics.

4) `committedChangeEvents`
Append-only, only for committed changes:
- `tsMs` (server timestamp)
- `controlId`
- `fromDiscreteState`, `toDiscreteState`
- `initiator: "user" | "model"`
- `activeModelId` (captured at commit time)

5) `holdMs`
- key fields: `controlId`, `modelId`, `clockId`, `bucketId`, `state`
- value: `ms` (accumulated)

6) `transCounts`
- key fields: `controlId`, `modelId`, `clockId`, `bucketId`, `fromState`, `toState`
- value: `count` (accumulated integer)

### Inputs and Outputs
- Inputs: schema definitions
- Output: Convex DB tables ready for mutations/queries

### Non-goals
- No UI
- No inference queries yet
- No retention behavior (quarters) yet

### Acceptance criteria
- `pnpm dev` starts Convex successfully with schema
- A smoke test (or manual via Convex dashboard) can insert:
  - config singleton
  - a radiobutton control definition and a slider control definition
  - runtime rows for each kind

### Edge cases
- Covered:
  - singleton config strategy documented (e.g., enforce “exactly one row” in code)
- Deferred:
  - migrations between schema versions

---

## Milestone 7 — Convex Mutations: Config, Control Management, Set Value (Committed vs Uncommitted)

### Goal
Expose stable APIs for:
- setting global config (timezone + lat/lon + inference params)
- creating controls
- setting active model per control
- setting control values (radiobutton discrete or slider continuous)
- committing a value change for analytics (debounced)

### Deliverables
In `convex/`:

#### Mutations
- `setConfig({ timezone, latitude, longitude, ...optional inference params })`
- `createControl({ controlId, definition })`
- `setActiveModel({ controlId, activeModelId })`

Control value update mutation (supports both kinds):
- `setControlValue(payload)`
  - payload includes:
    - `controlId`
    - `initiator: "user" | "model"`
    - `isCommitted: boolean`
    - plus either:
      - radiobutton: `newState` (discrete)
      - slider: `newValue01` (continuous)

#### Server-side behavior for `setControlValue`
1) Load control definition + runtime row.
2) Validate payload kind matches control kind.
3) Compute `tsMs = Date.now()` on server.
4) Update `controlRuntime` current values:
- radiobutton:
  - `currentDiscreteState = newState`
- slider:
  - `currentValue01 = newValue01`
  - derive `currentDiscreteState = discretize(newValue01, sliderBoundaryPolicy)`

5) If `isCommitted === false`:
- Do not append `committedChangeEvents`
- Do not update `lastCommittedAtMs` / `lastCommittedDiscreteState`
- (This supports slider dragging and debounced radiobutton toggling.)

6) If `isCommitted === true`:
- Append a `committedChangeEvents` row:
  - `fromDiscreteState = lastCommittedDiscreteState`
  - `toDiscreteState = derived new discrete state`
  - `initiator`, `activeModelId`, `tsMs`
- Update runtime commit fields:
  - `lastCommittedAtMs = tsMs`
  - `lastCommittedDiscreteState = toDiscreteState`
- Trigger analytics ingestion (Milestone 8)

Important:
- Debouncing is achieved by clients sending intermediate updates with
  `isCommitted=false`, and a final update with `isCommitted=true`.

### Inputs and Outputs
- Inputs: mutation args
- Outputs:
  - updated runtime state (current values)
  - optionally appended committed event (if committed)

### Non-goals
- No aggregates ingestion logic implemented here beyond calling Milestone 8 function
- No auth or role management

### Acceptance criteria
- End-to-end via tests or manual script:
  - create config
  - create controls (radiobutton + slider)
  - set active model
  - slider:
    - send several `isCommitted=false` updates with `newValue01`
    - then one `isCommitted=true` update
    - verify only one committed event is created
  - radiobutton:
    - send multiple `isCommitted=false` updates and one final `isCommitted=true`
    - verify only one committed event is created
  - verify committed event stores discrete from/to states and initiator/model

### Edge cases
- Covered:
  - invalid value/state rejected (no partial writes)
  - slider boundary policy applied consistently
- Deferred:
  - enforcing that clients *must* debounce (server trusts `isCommitted`)

---

## Milestone 8 — Measurement Ingestion: Update holdMs and transCounts on Committed Events

### Goal
Implement the MANUAL.md measurement rules using *committed* events as the trigger:
- Holding time is measured in real elapsed ms and split across buckets per clock
- Only user-initiated transitions are recorded as transitions
- All counts are attributed to the active model (captured at commit time)
- If integrity fails, discard affected data rather than ingest

Project-specific: debounced transitions
- Analytics updates occur only when `isCommitted=true` created a committed event.
- Uncommitted updates do not affect analytics.

### Deliverables
In `convex/measurement.ts` (or similar):
- An ingestion function invoked when a `committedChangeEvents` row is created:

1) Close previous holding interval (based on last committed change):
- `t0 = previous lastCommittedAtMs`
- `t1 = current committed event tsMs`
- `state = previous lastCommittedDiscreteState`
- attribute to `activeModelId` that was active during that interval
  (for simplicity, use the active model captured on the committed event;
   if active model can change between commits, decide and document behavior—
   MANUAL attribution expects “while model is active”; if this becomes ambiguous,
   add integrity checks and discard rather than guess.)

2) For each clock:
- split `[t0, t1)` into bucket allocations (use `packages/core/measurement`)
- increment `holdMs` for each `(clockId, bucketId, state)`
- if clock time is undefined for interval segments, skip those segments

3) If `initiator === "user"`:
- for each clock where timestamp mapping is defined:
  - compute containing bucket for `tsMs`
  - increment `transCounts` for `(fromState -> toState)` in that bucket

Data integrity checks:
- missing timestamps, negative intervals, missing active model, invalid state ⇒
  discard analytics update (do not partially apply)

### Inputs and Outputs
- Inputs: previous commit state, current committed event, global config
- Outputs: updated `holdMs` and `transCounts`

### Non-goals
- KDE smoothing
- CTMC inference
- Retention quarters

### Acceptance criteria
- Automated test scenario (Convex test env or integration test):
  1) Create slider control, set model A
  2) Uncommitted slider updates occur (no analytics impact)
  3) Commit a change from discrete 5 → 2 at t1 (initiator "user")
  Verify:
  - holding ms added only between committed timestamps
  - transition count increments only for the committed user change
  - response contains per-clock data where defined
- Additional test:
  - a committed change with initiator "model" does not increment transitions but
    does close holding interval and add holding time

### Edge cases
- Covered:
  - clock undefined ⇒ no counting for that clock
  - uncommitted updates produce no analytics noise
- Deferred:
  - recomputation/backfill from committed event log
  - performance optimization for high event volume

---

## Milestone 9 — Queries for Raw Aggregates (All Clocks) + Derived Time-of-Day Views

### Goal
Expose query APIs to retrieve (primarily for debugging/export):
- per-clock per-bucket raw aggregates for **all clocks in one response**
- optional per-model selection (via `modelId?`)
- derived time-of-day views (MANUAL-defined), for all clocks

### Deliverables
In `convex/queries.ts` (or similar):
- Queries:
  - `getControlDefinition(controlId)`
  - `getControlRuntime(controlId)`
  - `getRawStats({ controlId, modelId? })`
    - returns raw holdMs + transCounts, grouped by clock
    - behavior:
      - if `modelId` provided: stats for that model only
      - else: aggregated across all models for that control (sum across models)
  - `getRawTimeOfDayProfile({ controlId, modelId? })`
    - derived from time-of-week buckets per clock (sum across 7 days)

Important:
- These queries do not accept `clockId`.
- Response always includes all clocks keyed by `clockId`.

Suggested response shape (illustrative; exact JSON can vary):
- `{ clocks: { local: {...}, utc: {...}, meanSolar: {...}, apparentSolar: {...}, unequalHours: {...} } }`

### Inputs and Outputs
- Inputs: `controlId`, optional `modelId`
- Outputs: JSON structures suitable for debugging/export and as input to inference

### Non-goals
- No KDE
- No CTMC
- No UI

### Acceptance criteria
- Tests verifying:
  - response contains all five clocks
  - aggregated (no modelId) equals sum of per-model results (for a synthetic dataset)
  - time-of-day profile equals correct aggregation across days, per clock
  - queries behave sensibly with missing data (empty/zero results)

### Edge cases
- Covered:
  - “no data yet” returns empty/zero structures, not errors
- Deferred:
  - pagination and heavy-query performance concerns

---

## Milestone 10 — KDE Smoothing (Cyclic) for Point-in-Time Statistics (No Markov Damping Here)

### Goal
Implement KDE smoothing across time-of-week buckets to estimate sufficient
statistics at arbitrary query times (e.g., “noon exactly”), per MANUAL.md.

Important: KDE is time-axis smoothing. It is independent from Markov/CTMC
ergodicity stabilization (damping), which belongs in Milestone 11.

### Deliverables
In `packages/core/inference/kde/`:
- Kernel + cyclic weighting implementation:
  - takes raw per-bucket holdMs and transCounts (for one clock at a time)
  - outputs smoothed holdMs and transCounts for a target time-of-week position
- Configurable parameters:
  - `bandwidth` \(h\) (TBD; adjustable via Convex config)
  - `kernel` (optional; keep simple)
- Helpers for defining “query time”:
  - support querying by real timestamp `tsMs` by:
    - mapping `tsMs` to a time-of-week coordinate per clock
    - evaluating KDE at that coordinate (per clock)

In `convex/inferenceQueries.ts` (or similar):
- A query that returns KDE-smoothed sufficient statistics for **all clocks**:
  - `getSmoothedStatsAtTimestamp({ controlId, modelId?, tsMs })`
  - returns `{ clocks: { ... } }` where each clock includes smoothed holdMs and
    smoothed transCounts

### Inputs and Outputs
- Inputs: raw aggregates, query timestamp `tsMs`, KDE config
- Outputs: smoothed hold times and transition counts (per clock)

### Non-goals
- No stationary distribution yet
- No “best clock” metric selection

### Acceptance criteria
- Unit tests verifying:
  - cyclic wrap: buckets near week boundary influence each other
  - changing bandwidth changes smoothing extent
  - querying by `tsMs` produces per-clock results (or empty for clocks that are undefined)

### Edge cases
- Covered:
  - sparse data may still produce weak/near-zero transition structure (that’s OK here)
- Deferred:
  - picking final default bandwidth; keep configurable

---

## Milestone 11 — CTMC Construction + Stationary Distribution (Includes Markov Damping)

### Goal
Build CTMCs from KDE-smoothed statistics and compute stationary distributions as
preference estimates, per MANUAL.md. Ensure stationary computation remains stable
under sparse/disconnected observations by applying Markov damping (teleportation),
configurably.

### Spec decision gate (must not be guessed)
MANUAL.md does not fully specify the exact mathematical estimator for CTMC
generator rates from:
- holding times (ms per state), and
- user transitions (counts i→j)

Before implementation, do ONE of:
1) Update `docs/context/MANUAL.md` to specify the estimator (preferred), OR
2) Add explicit configuration in Convex config for CTMC rate estimation policy
   (documented and selectable), and implement at least one option

Do not silently pick a formula without documenting it.

### Markov damping / ergodicity stabilization (configurable)
Because transition observations may be sparse or disconnected, apply PageRank-style
damping (teleportation) during stationary distribution computation so the chain is:
- ergodic
- has a unique stationary distribution
- numerically stable

Example discrete form (if using a discrete approximation):
- \(P' = \alpha P + (1-\alpha)\mathbf{1}v^\top\)

Sanity check:
- If someone asks “what does the damping factor do?” the correct answer is:
  - “It prevents zero-probability / disconnected transition structure from breaking
    stationary distribution computation.”
- Not:
  - “It smooths the KDE.”

### Deliverables
In `packages/core/inference/ctmc/`:
- CTMC builder producing a generator matrix \(Q\) (or discrete \(P\)) from smoothed stats
- Stationary distribution solver:
  - returns a probability vector over control states
  - robust for radiobutton \(N=2..10\) and slider \(N=6\)
- Markov damping layer applied as configured (policy must be documented)

In `convex/inferenceQueries.ts`:
- A query that returns preference distributions for **all clocks**:
  - `getPreferenceAtTimestamp({ controlId, modelId?, tsMs })`
  - pipeline:
    1) read raw aggregates (per clock) (and per-model or aggregated)
    2) KDE smooth at query time coordinate per clock
    3) build CTMC/discrete chain per clock
    4) apply Markov damping per config
    5) compute stationary distribution per clock
    6) return `{ clocks: { ... } }`

### Inputs and Outputs
- Inputs: smoothed holdMs/transCounts, CTMC estimator config, Markov damping config
- Outputs: stationary distribution over states (per clock)

### Non-goals
- Model comparison metric (“which clock is best”) is still TBD
- UI visualizations

### Acceptance criteria
- Unit tests verifying:
  - stationary distribution sums to 1 (within tolerance)
  - no crashes on sparse/edge data because damping makes stationary computation well-defined
  - works for radiobutton and slider cases
- Integration test:
  - from a small synthetic dataset, preferences are returned for all clocks in one call

### Edge cases
- Covered:
  - clocks that are undefined at `tsMs` return “no data” for that clock (do not count)
- Deferred:
  - high-performance linear algebra optimizations

---

## Milestone 12 — Seasonal Retention: Rolling Quarters Q1–Q4 (Configurable; TBD Details)

### Goal
Introduce a seasonal retention structure (rolling quarters) without hardcoding a
policy that MANUAL.md marks as TBD.

### Deliverables
- Data partitioning strategy:
  - add `quarterKey` to events and/or aggregates
  - ensure queries can request a specific quarter or “current quarter”
- Retention configuration stored in `config`:
  - how many quarters retained
  - rollover timing rules (TBD)
- Maintenance job(s) (manual trigger is fine for local hobby use):
  - rollover current → next
  - drop or archive old quarters per config

### Inputs and Outputs
- Inputs: timestamps, current config
- Outputs: quarter-partitioned aggregates and correct query behavior

### Non-goals
- Perfect finalized retention policy
- Automatic background scheduling guarantees

### Acceptance criteria
- Tests verifying:
  - events/aggregates land in correct quarter
  - rollover moves new data to a new quarterKey
  - queries can filter by quarterKey

### Edge cases
- Covered:
  - quarter boundary timestamps
- Deferred:
  - long-term migration of old data layouts

---

## Milestone 13 — Minimal Dashboard UI (After APIs Stabilize)

### Goal
Implement a client-heavy dashboard that:
- lists controls and shows current state + active model
- allows changing values:
  - radiobutton: discrete selection
  - slider: continuous value in \([0,1]\)
- uses `isCommitted` behavior:
  - slider dragging uses `isCommitted=false` updates and a final `isCommitted=true`
  - radiobutton changes are debounced similarly (client-side)
- shows inferred preferences per clock (from KDE + CTMC), emphasizing point-in-time queries

### Deliverables
In `apps/web/`:
- Pages:
  - Controls list
  - Control detail (radiobutton/slider widgets)
  - Analytics view:
    - inferred preferences for all clocks (no clockId needed to fetch)
    - optional ability to inspect raw aggregates (debug/export view)
  - Config page (timezone, latitude, longitude; inference params + slider boundary policy exposed)
- Convex subscriptions/queries for realtime updates
- Basic visualization (lightweight charts acceptable)

### Inputs and Outputs
- Inputs: user actions, configuration edits
- Outputs: Convex mutations + rendered views

### Non-goals
- Advanced styling/polish
- Production auth/security
- Mobile-native UX

### Acceptance criteria
- Manual verification:
  - Two browser tabs remain synchronized on slider dragging (continuous value)
  - Only committed actions generate analytics events
  - Preference endpoint returns results for all clocks and can be displayed

### Edge cases
- Covered:
  - concurrent edits from multiple clients behave consistently (last-write-wins)
- Deferred:
  - offline support

---

## Milestone 14 — End-to-End Invariant Test Suite (Derived from MANUAL.md)

### Goal
Codify MANUAL.md invariants into automated tests to prevent semantic drift.

### Deliverables
- A suite of tests covering:
  - holding-time splitting correctness per clock (including DST + unequal hours)
  - “only user-initiated transitions counted”
  - “manual action does not change active model”
  - “undefined clock time ⇒ do not count for that clock”
  - “discard bad data rather than ingest”
- Include MANUAL’s concrete example scenario as an executable test case

Note:
- The project’s debounced analytics behavior should be tested explicitly:
  - uncommitted changes do not affect analytics
  - committed changes do

### Inputs and Outputs
- Inputs: synthetic event sequences + configs
- Outputs: passing test suite

### Non-goals
- Performance benchmarking
- Model-selection evaluation (metric still TBD)

### Acceptance criteria
- `pnpm test` passes with meaningful coverage of invariants
- Tests fail if invariants are intentionally violated

### Edge cases
- Covered:
  - missing timestamps / invalid states lead to discard behavior
- Deferred:
  - fuzz testing (optional later)

---