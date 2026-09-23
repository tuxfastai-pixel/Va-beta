# Pilot Pre-Test Checklist

This checklist defines the minimum readiness gates before starting the 3-user pilot.

## Guardrails Before Pilot

- Manual application mode is ON (`PILOT_MANUAL_APPLICATION_MODE=true` or unset).
- Auto-apply is blocked at orchestrator and API levels.
- Autonomous execution remains controlled until pilot quality/trust thresholds are met.

## Stage 1: Build Gate

Command:

```bash
npm run build
```

Pass criteria:

- Build completes with exit code 0.
- Static page generation completes.
- Finalization phase completes.

## Stage 2: Runtime Certification Gate

Command:

```bash
npm run validate:deterministic
```

Pass criteria:

- Constitutional simulation passes.
- Governance chaos tests pass.
- Trust regression tests pass.
- Replay certification passes.

## Stage 3: Pilot-Critical Workflow Validation

### 1) Onboarding

#### A. CV Upload Path

- User can upload CV.
- System extracts:
  - education
  - skills
  - certifications
  - projects
  - experience
  - interests

#### B. No CV Path

- User can complete profile via guided Q&A.
- Questions include:
  - Who are you?
  - Education?
  - Experience?
  - Skills?
  - Interests?
  - Desired job?
- AI builds usable profile from answers.

#### C. Partial CV Path

- User uploads incomplete CV.
- System merges CV + interview answers into a coherent profile.

### 2) Profile Improvement Engine

Before job recommendations, user sees employability guidance:

- missing LinkedIn
- incomplete CV
- missing portfolio
- missing GitHub
- weak interview readiness
- certification opportunities

Pass criteria:

- Guidance is specific, actionable, and personalized.

### 3) Manual Job Application Mode

- Auto-apply is disabled.
- Jobs display:
  - match reason
  - salary estimate
  - probability score
  - matched skills
- User must explicitly choose:
  - Accept
  - Reject

Pass criteria:

- No application is sent without explicit user confirmation.

### 4) Interview Preparation Trigger

When user chooses to apply, system immediately offers interview prep:

- common questions
- role-specific questions
- mock interview
- confidence coaching
- CV review

Pass criteria:

- Prep starts in-context for the selected role/job.

### 5) Continuity

- User exits session.
- User returns later.
- State restores correctly.

Pass criteria:

- Profile, progress, and key context persist.

### 6) Telemetry

Validate that events are recorded for pilot analytics:

- onboarding events
- job recommendation events
- user accept/reject decisions
- coaching/interview prep usage
- trust metrics
- recovery metrics

Pass criteria:

- Events are queryable and attributed to pilot users.

## Pilot Launch Decision

Proceed with 3-user pilot only when:

- Stage 1 is green.
- Stage 2 is green.
- Stage 3 critical flows pass.
- Manual apply guardrail is confirmed active.

## Stage 4: Persistence and Continuity Gates

### Gate 1: Apply Migrations

Apply all pilot-critical migration files:

- `supabase/migrations/20260606_create_career_profiles.sql`
- `supabase/migrations/20260606_create_runtime_state_tables.sql`
- `supabase/migrations/20260606_create_continuity_tables.sql`

### Gate 2: Run Persistence Smoke Test

Command:

```bash
npm run smoke:persistence
```

Pass criteria:

- `career_profiles` write/read passes.
- `user_personalization_states` write/read passes.
- `trust_history_records` write/read passes.
- `equilibrium_events` write passes.
- `runtime_rollout_policies` write passes.
- `runtime_snapshots` and `runtime_snapshot_anchors` write/read passes.

### Gate 3: Run Readiness Checker

Command:

```bash
npm run check:pilot-readiness
```

Pass criteria:

- Required environment variables are present.
- Supabase connectivity is valid.
- Required pilot continuity tables exist.

### Gate 4: Deploy and Re-verify

After Vercel deployment:

- Re-run `npm run check:pilot-readiness` against production env context.
- Re-run `npm run smoke:persistence` (or API-level manual equivalent) to confirm restart-safe persistence.
