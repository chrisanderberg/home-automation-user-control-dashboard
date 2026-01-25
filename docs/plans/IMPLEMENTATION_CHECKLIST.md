<!--
docs/plans/IMPLEMENTATION_CHECKLIST.md

Execution checklist for autonomous coding agents.

Rules:
- Implement exactly ONE milestone at a time.
- Do not implement future milestones.
- If any “Preconditions” item is not satisfied, STOP and ask the human.
- If any “Validation” item fails and cannot be fixed within the milestone scope,
  STOP and ask the human.
- docs/context/MANUAL.md is authoritative. Do not contradict it.
-->

## Change control (applies during implementation)

If you (the agent) believe the plan or checklist needs updating during
implementation:
1) STOP and ask the human to approve the proposed change first.
2) After approval:
   - update `docs/plans/IMPLEMENTATION_PLAN.md` and/or
     `docs/plans/IMPLEMENTATION_CHECKLIST.md`
     (and `docs/context/MANUAL.md` if domain semantics change),
   - then append an entry to `docs/plans/CHANGES.md`.

Do not change these docs unilaterally without approval.

## Change log checklist (CHANGES.md)

Before starting ANY milestone:
- Read `docs/plans/CHANGES.md` to check for recent approved changes.
- Ensure this checklist and the implementation plan already reflect those changes.
- If they do not, STOP and ask whether the checklist or plan should be updated.

When a change is approved during implementation:
- Update the affected doc(s) first:
  - `docs/plans/IMPLEMENTATION_PLAN.md`
  - `docs/plans/IMPLEMENTATION_CHECKLIST.md`
  - `docs/context/MANUAL.md` (only if semantics change)
- Then append a new entry to `docs/plans/CHANGES.md`.

Before marking a milestone complete:
- Confirm that any deviations discovered during implementation have either:
  - been explicitly approved and logged in `CHANGES.md`, or
  - been reverted so the milestone matches the plan exactly.

### Standard change proposal format

When stopping to request approval for a change, the agent MUST present the
request using the “CHANGE PROPOSAL — Approval Requested” format defined below.

Do not ask informal or underspecified questions.
Do not implement any change until approval is explicitly given.

CHANGE PROPOSAL — Approval Requested

Context:
- Current milestone: <Milestone number + title>
- Current task: <what the agent was trying to do>

Problem encountered:
- What is unclear / blocked / inconsistent?
- Why this cannot be resolved without changing docs or making a decision?

Proposed change:
- Concise description of the proposed change.
- Is this:
  - [ ] Plan-only change
  - [ ] Checklist-only change
  - [ ] Plan + Checklist change
  - [ ] MANUAL.md (semantic) change

Details:
- What exactly would change?
- What would be added / removed / reworded?
- Any new config fields introduced?

Alternatives considered:
- Option A: <summary + why rejected>
- Option B: <summary + why rejected>
- (If none, say “No reasonable alternatives.”)

Impact assessment:
- Affected milestones: <list>
- Backwards compatibility: <none | requires migration | breaks existing data>
- Risk level: <low | medium | high> (brief justification)

Requested decision:
- Approve as proposed?
- Approve with modifications? (please specify)
- Reject (agent will revert / pause)

If approved:
- Agent will:
  1) Update affected docs
  2) Append entry to `docs/plans/CHANGES.md`
  3) Resume milestone execution

# Implementation Execution Checklist (Per Milestone)

This checklist mirrors `docs/plans/IMPLEMENTATION_PLAN.md` milestone-by-milestone.

Global hard rules (apply to every milestone):
- Do NOT hardcode policies marked TBD:
  - KDE bandwidth defaults
  - slider boundary rounding (0.25/0.5/0.75)
  - CTMC rate estimator
  - rolling quarters retention/rollover (quarter definition is now specified; only retention/rollover policy is TBD)
  - “best clock” evaluation metric
- Do NOT add new abstractions not in the plan.
- Analytics queries must NOT accept `clockId` input and must ALWAYS return all
  clocks keyed by `clockId`.
- Slider runtime state is continuous `value01 ∈ [0,1]`; analytics uses derived
  discrete states 0..5.
- Analytics transitions are debounced: only committed changes produce analytics
  events.

---

## Milestone 1 — Monorepo Scaffold + Local Dev Runtime

### 1) Preconditions (HARD GATES)
- You have the current `IMPLEMENTATION_PLAN.md` and `MANUAL.md` available.
- You know the package manager choice:
  - default is `pnpm` (recommended in plan).

STOP if:
- You cannot run Node tooling locally.

### 2) Implementation checklist
- Create monorepo structure:
  - `apps/web/` (TanStack Start initialized; no real UI yet)
  - `packages/core/` (pure TS package; no Convex imports)
  - `convex/` (Convex initialized)
- Set up TypeScript project references or equivalent so `packages/core` can be
  imported from both `apps/web` and `convex`.
- Add a test runner targeting `packages/core` (Vitest recommended).
- Add root scripts:
  - `dev` (runs Convex + web dev server)
  - `test` (runs unit tests)

DO NOT:
- Add domain logic beyond a smoke test.
- Add UI features.

### 3) Validation checklist
Run:
- `pnpm install`
- `pnpm test`
- `pnpm dev`

Verify:
- Convex dev server starts cleanly.
- Web dev server starts cleanly.
- A trivial core test passes.

### 4) Stop / escalation conditions
STOP if:
- `pnpm dev` cannot start Convex locally (environment/tooling issue).
- Workspace imports are broken in a way you can’t resolve without changing repo
  strategy.

---

## Milestone 2 — Domain Model Types + Validation (Controls, States, Slider Mapping)

### 1) Preconditions (HARD GATES)
- Milestone 1 complete; `pnpm test` passes.
- `packages/core` exists and is importable.

STOP if:
- You cannot run tests reliably.

### 2) Implementation checklist
- Implement domain types in `packages/core/domain`:
  - `ControlKind = "radiobutton" | "slider"`
  - control definitions:
    - radiobutton: `2 <= N <= 10`
    - slider: analytics discretized into exactly 6 states (0..5)
  - state types:
    - discrete state for radiobutton: 0..N-1
    - discrete state for slider: 0..5
  - slider continuous type: `value01 ∈ [0,1]`
- Implement slider discretization mapping:
  - 0 → 0
  - 1 → 5
  - (0, 0.25) → 1
  - (0.25, 0.5) → 2
  - (0.5, 0.75) → 3
  - (0.75, 1) → 4
- Boundary behavior at 0.25, 0.5, 0.75:
  - MUST be configurable / policy-driven
  - MUST NOT be silently assumed
- Add Zod validation for:
  - control definitions
  - radiobutton `newState`
  - slider `newValue01`
- Define “set value” request input types used later by Convex:
  - includes `initiator: "user" | "model"`
  - includes `isCommitted: boolean`
  - radiobutton payload uses discrete `newState`
  - slider payload uses continuous `newValue01`

DO NOT:
- Introduce Convex code.
- Implement clocks, KDE, CTMC.

### 3) Validation checklist
Run:
- `pnpm test`

Add/verify tests:
- Radiobutton N out of range rejected.
- Slider `value01` outside [0,1] rejected.
- Slider discretization correct for interior ranges.
- Boundary policy is required/explicit (test fails if boundary is handled without
  policy).

### 4) Stop / escalation conditions
STOP if:
- You are tempted to pick a boundary rounding rule without a config/policy.
- The domain model starts contradicting MANUAL.md invariants.

---

## Milestone 3 — Bucket Indexing Utilities (2016/week + Cyclic Helpers)

### 1) Preconditions (HARD GATES)
- Milestones 1–2 complete.
- Tests passing.

### 2) Implementation checklist
- Implement time-of-week bucket constants:
  - 5-minute buckets
  - 288/day, 2016/week
- Implement utilities:
  - bucket index ↔ label (day + minute range)
  - cyclic distance across week boundary
  - helper for time-of-day view aggregation (sum 7 corresponding buckets)

DO NOT:
- Implement timestamp mapping yet (that’s clocks).

### 3) Validation checklist
Run:
- `pnpm test`

Add/verify tests:
- Monday 00:00 bucket is 0.
- Sunday 23:55 bucket is 2015.
- Cyclic distance wraps Sunday→Monday correctly.

### 4) Stop / escalation conditions
STOP if:
- Any off-by-one ambiguity remains unresolved in bucket indexing.

---

## Milestone 4 — Five Clocks: Timestamp → BucketId | undefined

### 1) Preconditions (HARD GATES)
- Milestones 1–3 complete.
- A plan for timezone handling exists (IANA timezone string in config).

STOP if:
- You cannot pick or integrate a reasonable solar-time library without breaking
  the “undefined time-of-day” invariant.

### 2) Implementation checklist
- Implement `ClockId` and clock mapping interface in `packages/core/clocks`.
- Implement timestamp→bucket mapping for:
  - utc
  - local (timezone + DST safe)
  - meanSolar (longitude-based; undefined at poles allowed)
  - apparentSolar (meanSolar + equation of time; undefined at poles allowed)
  - unequalHours (requires sunrise & sunset; undefined when no sunrise/sunset)
- Ensure mapping returns `undefined` when clock time-of-day is undefined (per
  MANUAL).

DO NOT:
- Start splitting intervals.
- Implement analytics storage.

### 3) Validation checklist
Run:
- `pnpm test`

Add/verify tests:
- Deterministic mapping for a fixed timestamp/config for each clock.
- Local DST boundary mapping doesn’t crash.
- UnequalHours returns undefined for a polar-day/polar-night case.
- Mean/apparent undefined at poles if treated so.

### 4) Stop / escalation conditions
STOP if:
- Local DST mapping produces ambiguous or inconsistent behavior you can’t test.
- Undefined cases are not representable cleanly (must be `undefined`, not “fake”).

---

## Milestone 5 — Holding Interval Splitting Across Buckets (Per Clock)

### 1) Preconditions (HARD GATES)
- Milestones 1–4 complete.
- Clock timestamp mapping works and is tested.

STOP if:
- You cannot ensure “sum of split ms equals real elapsed ms” for defined portions.

### 2) Implementation checklist
- Implement `splitHoldInterval`:
  - input: `[t0Ms, t1Ms)`, clockId, config
  - output: `Map<bucketId, ms>`
- Must:
  - split at bucket boundaries under each clock
  - allocate real elapsed ms
  - skip undefined segments for clocks returning undefined mapping
  - support week wrap
- Keep implementation in `packages/core` (no Convex).

DO NOT:
- Implement transition counting.
- Implement Convex ingestion.

### 3) Validation checklist
Run:
- `pnpm test`

Add/verify tests:
- Single-bucket interval allocation.
- Multi-bucket allocation sums to `t1 - t0`.
- Week wrap split.
- DST boundary interval split (local).
- Unequal-hours variable bucket lengths do not break sum property.
- Undefined segments are excluded.

### 4) Stop / escalation conditions
STOP if:
- You cannot define what “undefined segment” means operationally (it must be “do
  not count for that clock” per MANUAL).

---

## Milestone 6 — Convex Schema: Config, Controls, Runtime State, Event Log, Aggregates

### 1) Preconditions (HARD GATES)
- Milestones 1–5 complete.
- Convex project is initialized and runs in dev.

STOP if:
- You cannot represent singleton config cleanly.

### 2) Implementation checklist
- Implement Convex schema tables per plan:
  - `config` singleton including:
    - timezone, latitude, longitude
    - KDE params (bandwidth, kernel)
    - slider boundary policy
    - Markov damping params (alpha, teleport prior)
    - CTMC estimator config placeholder
    - retention config placeholder
  - `controls`
  - `controlRuntime` including:
    - `currentValue01` for sliders
    - `currentDiscreteState` always present (derived for sliders)
    - commit tracking fields (`lastCommittedAtMs`, `lastCommittedDiscreteState`)
  - `committedChangeEvents` (append-only)
  - `holdMs`, `transCounts`
- Document “current vs committed” semantics in comments near schema.

DO NOT:
- Add clockId-filtering fields to queries (queries must return all clocks later).

### 3) Validation checklist
Run:
- `pnpm dev`

Verify via Convex dashboard/logs:
- Schema loads.
- You can insert config + a control + runtime rows without schema errors.

Run:
- `pnpm test` (core tests should still pass)

### 4) Stop / escalation conditions
STOP if:
- Slider runtime cannot store continuous value cleanly.
- You cannot keep both `currentDiscreteState` and `currentValue01` consistent.

---

## Milestone 7 — Convex Mutations: Config, Control Management, Set Value (Committed vs Uncommitted)

### 1) Preconditions (HARD GATES)
- Milestones 1–6 complete.
- Schema deployed to local Convex dev instance.

STOP if:
- You cannot ensure server-side timestamps (`Date.now()`) are used consistently.

### 2) Implementation checklist
- Implement mutations:
  - `setConfig`
  - `createControl`
  - `setActiveModel`
  - `setControlValue` (supports both kinds; includes `initiator`, `isCommitted`)
- Implement server-side logic:
  - validate payload kind vs control kind
  - update runtime “current” state:
    - slider: store `currentValue01` and derived `currentDiscreteState`
    - radiobutton: store `currentDiscreteState`
  - if `isCommitted=false`: no committed event, no analytics changes
  - if `isCommitted=true`:
    - create a committed event using discrete from/to states
    - update commit tracking fields in runtime
    - trigger analytics ingestion hook (to be implemented in Milestone 8)
- Ensure discretization uses config boundary policy (TBD default allowed, but must
  be explicit and configurable).

DO NOT:
- Record analytics transitions for uncommitted updates.

### 3) Validation checklist
Run:
- `pnpm dev`

Manually (or via small script) verify:
- Slider: many uncommitted updates create no committed events.
- A final committed update creates exactly one committed event.
- Radiobutton: same pattern.
- Committed event includes: from/to discrete, initiator, activeModelId, tsMs.

Run:
- `pnpm test`

### 4) Stop / escalation conditions
STOP if:
- You need to invent debouncing semantics beyond `isCommitted` (the plan relies
  on this contract).
- Boundary rounding policy is being silently chosen.

---

## Milestone 8 — Measurement Ingestion: Update holdMs and transCounts on Committed Events

### 1) Preconditions (HARD GATES)
- Milestones 1–7 complete.
- Core splitting works (Milestone 5).
- Committed events exist and are only created for committed changes.

STOP if:
- You cannot determine prior committed state/time needed to close holding
  intervals.

### 2) Implementation checklist
- Implement ingestion function triggered on committed events:
  - close hold interval: `[prevCommittedAtMs, currentCommittedTsMs)`
  - state = `prevCommittedDiscreteState`
  - split per clock, add to `holdMs`
  - if initiator is user, increment `transCounts` per clock at event bucket
- Quarter windowing:
  - Compute `windowId` from event timestamp using UTC calendar quarter
  - Format: `"YYYY-Q{1-4}"` (e.g., `"2024-Q1"`)
  - Quarter boundaries: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec), all in UTC calendar time
  - All analytics data partitioned by this `windowId` in `analyticsBlobs` and `analyticsBlobChunks`
- Integrity:
  - if timestamps missing/invalid, negative interval, invalid states, missing
    model attribution → discard update (no partial ingest)
- Clocks:
  - always process all clocks
  - skip clocks where mapping undefined (per MANUAL)

Important modeling note (do not guess):
- If active model can change between commits and affects attribution, implement
  an explicit rule consistent with plan:
  - either use captured model at commit time AND detect inconsistencies, or
  - discard on ambiguity rather than guess.

DO NOT:
- Count transitions for `initiator="model"`.
- Ingest on uncommitted updates.

### 3) Validation checklist
Run:
- `pnpm dev`

Create a test sequence (script or automated test):
- slider control:
  - uncommitted updates do not affect analytics
  - committed change triggers:
    - holding time increments between commit timestamps
    - user committed change increments transition counts
    - model committed change does not increment transition counts
- Verify results include all clocks where defined.

Run:
- `pnpm test`

### 4) Stop / escalation conditions
STOP if:
- You find you must attribute holding time to a model but cannot determine which
  model was active over the interval without guessing. Implement discard-on-ambiguity
  or ask the human to decide a rule.

---

## Milestone 9 — Queries for Raw Aggregates (All Clocks) + Derived Time-of-Day Views

### 1) Preconditions (HARD GATES)
- Milestones 1–8 complete.
- Aggregates (`holdMs`, `transCounts`) are being populated.

STOP if:
- You cannot return all clocks in one response without excessive complexity.

### 2) Implementation checklist
- Implement queries:
  - `getControlDefinition`
  - `getControlRuntime`
  - `getRawStats({ controlId, modelId?, windowId?, tsMs? })`
  - `getRawTimeOfDayProfile({ controlId, modelId?, windowId?, tsMs? })`
- Enforce query contract:
  - NO `clockId` input parameter
  - response ALWAYS keyed by all clocks:
    - local, utc, meanSolar, apparentSolar, unequalHours
- Implement aggregation behavior:
  - if `modelId` provided: return that model only
  - else: sum across models
- Implement quarter filtering behavior:
  - if `windowId` provided: filter by that quarter (format: "YYYY-Q{1-4}")
  - if `tsMs` provided: compute quarter from timestamp and filter by that quarter
  - if both `windowId` and `tsMs` provided: `windowId` takes precedence
  - if neither provided: aggregate across all quarters (backward compatibility)

DO NOT:
- Add optional clock filtering “for debugging” (explicitly forbidden).

### 3) Validation checklist
Run:
- `pnpm dev`

Verify:
- Query responses include all five clocks as keys.
- Aggregated (no modelId) equals sum of per-model responses for test data.
- Time-of-day profile equals sum across 7 days per clock.

Run:
- `pnpm test`

### 4) Stop / escalation conditions
STOP if:
- You are about to add `clockId` as input to make implementation easier.

---

## Milestone 10 — KDE Smoothing (Cyclic) for Point-in-Time Statistics (No Markov Damping Here)

### 1) Preconditions (HARD GATES)
- Milestones 1–9 complete.
- Raw aggregates queryable.

STOP if:
- You can’t define cyclic distance consistently with Milestone 3 utilities.

### 2) Implementation checklist
- Implement KDE smoothing in `packages/core/inference/kde`:
  - smooth along cyclic time-of-week axis
  - configurable bandwidth \(h\) and kernel
- Implement inference query:
  - `getSmoothedStatsAtTimestamp({ controlId, modelId?, tsMs })`
  - returns `{ clocks: { ... } }` for all clocks
- Ensure KDE uses per-clock mapping of `tsMs` to time-of-week coordinate.
- If a clock’s time-of-day is undefined at `tsMs`, return “no data” for that
  clock for smoothed stats.

DO NOT:
- Add Markov damping / teleportation here.
- Claim KDE “fixes” disconnected transitions.

### 3) Validation checklist
Run:
- `pnpm test`

Add/verify tests:
- cyclic wrap behavior (Sunday↔Monday).
- bandwidth changes smoothing extent.
- output includes all clocks.
- undefined clocks return empty/no-data for that clock.

Run:
- `pnpm dev` and manually call query (script ok).

### 4) Stop / escalation conditions
STOP if:
- You need to introduce “damping” to make KDE behave—damping belongs to Milestone 11.

---

## Milestone 11 — CTMC Construction + Stationary Distribution (Includes Markov Damping)

### 1) Preconditions (HARD GATES)
- Milestones 1–10 complete.
- You have an explicit CTMC estimator rule.

HARD STOP unless one is true:
- (Preferred) `docs/context/MANUAL.md` has been updated to specify CTMC rate
  estimation, OR
- You have implemented a configurable CTMC estimator policy and documented it in
  config and code comments.

Also required:
- Markov damping parameters exist in config.

### 2) Implementation checklist
- Implement CTMC (or discrete approximation) builder from smoothed stats:
  - produce \(Q\) or \(P\) per clock
  - support radiobutton N=2..10 and slider N=6
- Implement stationary distribution solver.
- Implement Markov damping (teleportation) as configured to ensure:
  - ergodicity
  - unique stationary distribution
  - numerical stability under sparse/disconnected transitions
- Implement query:
  - `getPreferenceAtTimestamp({ controlId, modelId?, tsMs })`
  - returns stationary distribution per clock in a single response.

DO NOT:
- Put damping in KDE.
- Add clockId filtering to the query.

### 3) Validation checklist
Run:
- `pnpm test`

Add/verify tests:
- Stationary distribution sums to 1 (within tolerance).
- Works for small N and slider N=6.
- Sparse/disconnected transition data still yields a defined stationary result
  when damping enabled.
- Output includes all clocks; undefined clocks return no-data.

Run:
- `pnpm dev` and call `getPreferenceAtTimestamp` manually.

### 4) Stop / escalation conditions
STOP if:
- CTMC estimator is not explicitly defined/configured.
- You are tempted to “pick a formula” without documentation.

---

## Milestone 12 — Seasonal Retention: Rolling Quarters Q1–Q4 (Configurable; TBD Details)

### 1) Preconditions (HARD GATES)
- Milestones 1–11 complete.
- Retention/rollover behavior is explicitly configurable (since details are TBD).

STOP if:
- You cannot implement quarters without hardcoding rollover rules.

### 2) Implementation checklist
- Note: Quarter partitioning already exists via `windowId` field (format: "YYYY-Q{1-4}") implemented in Milestone 8.
- Implement config fields controlling:
  - retention count
  - rollover triggers/timing (TBD but configurable)
- Implement a maintenance job or manual trigger to:
  - rollover
  - drop/archive old quarters

DO NOT:
- Hardcode retention policy details as if they were finalized.

### 3) Validation checklist
Run:
- `pnpm test`

Add/verify tests:
- Quarter assignment at boundaries (already verified in Milestone 8).
- Query filtering by `windowId` (already verified in Milestone 9).
- Rollover creates new quarter partitions.
- Retention policy correctly drops/archives old quarters per config.

Run:
- `pnpm dev` and verify maintenance job works.

### 4) Stop / escalation conditions
STOP if:
- You must decide retention rules not specified/configurable.

---

## Milestone 13 — Minimal Dashboard UI (After APIs Stabilize)

### 1) Preconditions (HARD GATES)
- Milestones 1–12 complete (or at least through 11 if retention is deferred).
- Convex queries/mutations stable and callable.

STOP if:
- Backend APIs are still changing weekly; stabilize first.

### 2) Implementation checklist
- Implement pages:
  - Controls list
  - Control detail:
    - radiobutton widget (discrete)
    - slider widget (continuous `value01`)
  - Analytics view:
    - uses `getPreferenceAtTimestamp` (all clocks)
    - optional raw aggregates debug view
  - Config view:
    - timezone, latitude, longitude
    - KDE params, Markov damping params
    - slider boundary rounding policy
- Implement client behavior:
  - send uncommitted updates during interaction (`isCommitted=false`)
  - send final committed update (`isCommitted=true`)
  - keep other clients synchronized via runtime subscription

DO NOT:
- Reintroduce discrete slider UI (slider is continuous to user).
- Record analytics transitions for uncommitted updates.

### 3) Validation checklist
Run:
- `pnpm dev`

Manual checks:
- Two browser tabs synchronize slider dragging (continuous value).
- Only final commit produces committed event and analytics changes.
- Analytics view shows preferences for all clocks side-by-side.

Run:
- `pnpm test`

### 4) Stop / escalation conditions
STOP if:
- You need backend changes to implement basic UI sync; fix APIs in earlier milestones.

---

## Milestone 14 — End-to-End Invariant Test Suite (Derived from MANUAL.md)

### 1) Preconditions (HARD GATES)
- Milestones 1–13 complete (or at least through 11 if UI deferred).
- Stable test runner.

STOP if:
- Prior milestone acceptance tests are flaky; fix flakiness first.

### 2) Implementation checklist
- Add scenario tests derived from MANUAL invariants:
  - holding interval splitting per clock (DST + unequal hours)
  - user-only transitions counted
  - manual intervention does not change active model
  - undefined clock time → do not count for that clock
  - discard bad data rather than ingest
- Add tests for project-specific debounced analytics:
  - uncommitted updates do not change analytics
  - committed updates do
- Encode MANUAL “Concrete example” as a test.

DO NOT:
- Rewrite invariants; implement tests against them.

### 3) Validation checklist
Run:
- `pnpm test`

Verify:
- Tests fail if any invariant is intentionally broken.
- Coverage includes at least one DST case and one unequal-hours undefined case.

Run:
- `pnpm dev` (optional sanity) and confirm system still runs.

### 4) Stop / escalation conditions
STOP if:
- Any test requires choosing a TBD policy (e.g., CTMC estimator) that isn’t
  explicitly configured/documented.

---