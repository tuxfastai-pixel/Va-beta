# Controlled 3-User Pilot Runbook

## Goal
Launch a controlled 2-week pilot and collect high-signal usability + outcome data.

## Scope
- User A: Founder (power user / edge cases)
- User B: Teacher (career transition / medium literacy)
- User C: Non-technical user (simplicity + trust)

## Freeze Rules (2 Weeks)
- Do not add major features.
- Do not redesign core flows unless blocker-level UX failure is confirmed.
- Only fix severe bugs, data integrity issues, and security issues.

## Deploy Sequence
1. Deploy app to Vercel (production).
2. Set production environment variables in Vercel.
3. Verify health by loading core routes.
4. Manually create pilot user accounts.

## Day-0 Verification
1. `npm run check:pilot-readiness`
2. `npm run smoke:persistence`
3. Run one real continuity test:
   - Create profile
   - Generate recommendations
   - Accept one recommendation
   - Generate interview coaching
   - Restart app/session
   - Re-login and verify persistence

## Daily Pilot Session Script (Per User)
1. Onboarding
   - Upload CV (or answer guided intake)
   - Confirm profile generation
2. Job Discovery
   - Review recommendations
   - Evaluate recommendation explanation trust
   - Accept or reject at least one recommendation
3. Interview Coaching
   - Start coaching for selected role
   - Rate usefulness + realism + confidence impact
4. Friction Capture
   - Record where user got stuck or confused

## Metrics to Capture
Use `PILOT_2WEEK_OBSERVATION_TEMPLATE.csv`.

Primary metrics:
- Onboarding success rate
- Recommendation relevance (1-10)
- Explanation trust (1-10)
- Coaching usefulness (1-10)
- Return intent (Yes/No)
- Recommendation intent (Yes/No)

## Review Cadence
- Day 3: early blockers only
- Day 7: midpoint synthesis
- Day 14: final pilot review and priority list

## Success Criteria
- All three users complete onboarding.
- All three users receive and evaluate recommendations.
- All three users complete at least one interview coaching flow.
- Persistence survives restart for all three users.
- At least 2/3 users report they would return tomorrow.

## Post-Pilot Output
Produce one summary with:
1. Top 5 blockers
2. Top 5 delight moments
3. Top 5 changes to prioritize next
4. Go/No-Go recommendation for broader beta
