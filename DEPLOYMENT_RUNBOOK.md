# Phase 1 Deployment & Testing Runbook

## 📋 Pre-Deployment Checklist

### Code Ready
- ✅ All 9 stage components implemented
- ✅ All 13 API endpoints implemented
- ✅ Dynamic route architecture complete
- ✅ Login redirect logic integrated into `/api/auth/login`
- ✅ Stage access control updated (allows completed stages, blocks future stages)
- ⏳ TypeScript build running (in progress)

### Database Ready
- ⏳ Migration created: `supabase/migrations/20260713_career_journey_stage_tracking.sql`
- ⏳ Needs to be applied to live Supabase

### Environment Ready
- ✅ Code committed (if applicable)
- ✅ `.env.local` configured for development
- ⏳ Deployment environment (Vercel) ready

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migration to Supabase

**Location**: `supabase/migrations/20260713_career_journey_stage_tracking.sql`

**Via Supabase Dashboard**:
1. Go to https://app.supabase.com → Select project → SQL Editor
2. Create new query
3. Copy entire migration file contents
4. Execute query
5. Verify tables created:
   - ALTER on `career_activation_states` (new columns: current_stage, completed_stages, career_activation_completed, last_job_id, last_assessment_id, last_cv_version_id)
   - New table: `career_journey_state`
   - New table: `cover_letter_generations`

**Via CLI** (if available):
```bash
supabase db push --remote
# or manually upload SQL file via dashboard
```

### Step 2: Verify Login Endpoint Changes

**File**: `app/api/auth/login/route.ts`

**Changes Implemented**:
- Added import: `import { resolveLoginRedirectStage } from "@/lib/career/careerJourneyService.ts";`
- Updated `resolvePostAuthRedirect()` to accept userId parameter
- Added logic to check for active career activation and redirect to resumed stage
- Falls back to existing redirect logic if no active career activation

**Verification**: After deployment, login with a user who was in the middle of career activation should redirect them to their current stage.

### Step 3: Build & Deploy to Vercel

```bash
# From va-beta directory
npm run build:compile
npm run build:generate
# or simply:
npm run build

# Vercel will auto-deploy on git push, or manually trigger:
# In Vercel dashboard: Deployments → Redeploy latest
```

**Expected Build Result**: ✅ No TypeScript errors, successful production build

**Expected Deployment Duration**: 3-5 minutes

---

## 🧪 Testing Plan

### Prerequisites
- Fresh test user email (allowlisted in `ALLOWED_USER_EMAILS`)
- Access to live Supabase dashboard
- Ability to logout/login in browser

### Test Scenario 1: Complete Full Journey (No Interruption)

**Steps**:
1. Register new user with fresh email
2. Complete onboarding steps 1-5
3. Click "Complete" → should redirect to `/career-activation/complete`
4. Click "Continue to CV Upload" → paste sample CV text → continue
5. Review AI profile improvements → continue
6. Review CV changes, approve one, reject one → continue
7. Review career summary → continue
8. Browse job discovery → continue
9. Review job assessment → continue
10. Review application pack:
    - Verify CV shows approved changes
    - Verify cover letter shows "Not generated yet"
    - Click "Approve CV" button
    - Note: "Ready for manual submission. Do not auto-submit."
    - Continue
11. Review interview prep:
    - Verify company overview
    - Verify expected questions listed
    - Click "Start Learning Sprint"
    - Click "Complete & Return to Dashboard"
12. Verify redirected to `/dashboard`
13. Query DB: verify `career_activation_completed = true` for user

**Expected Result**: ✅ User reaches dashboard with all stages completed

### Test Scenario 2: Refresh at Multiple Stages

**Steps**:
1. Register new user
2. Complete onboarding
3. Enter career activation at `/career-activation/complete`
4. Refresh page → should still show "Career Activation Complete"
5. Click continue → enter `/career-activation/cv-intake`
6. Refresh page → should still show CV intake screen with empty textarea
7. Paste CV text → submit
8. Refresh page → should still show profile review
9. Continue through 3-4 more stages, refresh each time
10. Verify no lost state

**Expected Result**: ✅ Refresh at any stage preserves progress, can continue

### Test Scenario 3: Logout & Login Resume Journey

**Setup**: User has completed stages 1-4 (through cv-improvements)

**Steps**:
1. Complete onboarding + career activation through cv-improvements stage
2. Click logout (or close browser)
3. Log back in
4. Verify redirected to `/career-activation/career-summary` (current stage after cv-improvements)
5. Verify can go back and review cv-improvements stage (click browser back or navigate manually)
6. Verify can access `/career-activation/cv-intake` (completed stage)
7. Verify cannot access `/career-activation/job-assessment` (future unmet stage) without completing career-summary first

**Expected Result**: ✅ Resume on same stage, can review completed earlier stages, blocked from future stages

### Test Scenario 4: URL Blocking (Future Stage Access)

**Setup**: User has completed stages 1-3 only (through profile-review)

**Steps**:
1. Complete onboarding + stages 1-3
2. Manually navigate to `/career-activation/job-assessment` (stage 7, skipping stages 4-6)
3. Observe redirect and error message
4. Verify landed on current stage or `/career-activation/complete`
5. Try `/career-activation/cv-intake` (stage 2, already completed) → should load successfully
6. Try `/career-activation/job-discovery` (stage 6, not reached) → should redirect with error

**Expected Result**: ✅ Future stages blocked, earlier completed stages accessible

### Test Scenario 5: Multiple Stages Review (Completed Stages Accessible)

**Setup**: User has reached stage 5 (career-summary)

**Steps**:
1. At stage 5, manually navigate back to `/career-activation/cv-intake` (stage 2)
2. Should load successfully (earlier completed stage)
3. Review CV from intake
4. Navigate back to `/career-activation/profile-review` (stage 3)
5. Should load successfully
6. Navigate to `/career-activation/cv-improvements` (stage 4)
7. Should load successfully
8. Try navigate to `/career-activation/application-pack` (stage 8, not yet reached)
9. Should redirect with error

**Expected Result**: ✅ Completed earlier stages remain accessible for review/correction

### Test Scenario 6: Application Pack Requirements

**Setup**: User navigates to application-pack stage

**Steps**:
1. From job-assessment stage, click continue → application-pack
2. Verify application pack loads with job details, match score
3. Verify CV section shows "Tailored CV" with "Approve CV" button
4. Verify cover letter section shows "Not generated yet" (Phase 4 feature)
5. Click "Approve CV" button → verify button changes to checkmark
6. Note message: "Ready for manual submission. Do not auto-submit in the pilot."
7. Click "Continue to Interview Prep"

**Expected Result**: ✅ Application pack displays correctly, no auto-submission, manual ready state shown

### Test Scenario 7: Session Handling (Cookie Persistence)

**Steps**:
1. Login user
2. Verify session cookie set: dev tools → Application → Cookies → session token present
3. Complete multiple stages (verifies cookie auth working)
4. Close browser completely
5. Reopen browser, return to site
6. Verify session still valid (not redirected to login)
7. Verify landed on correct resumed stage

**Expected Result**: ✅ Session persists across browser close/reopen

### Test Scenario 8: Error Handling

**Steps**:
1. At any stage, simulate API failure (dev tools → Network → throttle to offline)
2. Try to submit form / continue
3. Verify error message displayed
4. Verify can retry after connection restored
5. At CV intake, try paste without text, click continue
6. Verify button disabled and/or error shown
7. At CV improvements, reject a change
8. Verify change marked as rejected
9. Try to approve after rejection
10. Verify state updates correctly

**Expected Result**: ✅ Errors handled gracefully, users can retry

---

## 🔍 Post-Deployment Verification

### Database Queries to Verify State

```sql
-- Check career_activation_states table structure
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'career_activation_states'
ORDER BY ordinal_position;

-- Verify test user state
SELECT user_id, current_stage, completed_stages, career_activation_completed, updated_at
FROM career_activation_states
WHERE user_id = '[test-user-id]';

-- Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('career_journey_state', 'cover_letter_generations');
```

### Production Logs to Monitor

**Vercel Dashboard** → Recent Deployments → Function Logs:
- Watch for errors in `/api/auth/login` (should see resolveLoginRedirectStage calls)
- Watch for errors in `/api/career/*` endpoints (should see stage transitions)
- Monitor error rates in career activation routes

### User Acceptance Criteria Met

- ✅ User completes onboarding and enters career activation
- ✅ All 9 stages load with correct data
- ✅ Stage transitions work correctly
- ✅ Refresh preserves progress
- ✅ Logout/login resumes correct stage
- ✅ Earlier stages remain accessible for review
- ✅ Future stages blocked until prerequisites met
- ✅ "Ready for manual submission" message shown on application pack
- ✅ No auto-submission in pilot

---

## 📊 Success Criteria

### Phase 1 Production-Complete When:

- ✅ Database migration applied to live Supabase
- ✅ Vercel deployment successful (0 build errors)
- ✅ All 8 test scenarios pass
- ✅ Production logs show no errors
- ✅ User can complete full journey: signup → onboarding → all 9 career activation stages → dashboard
- ✅ User can logout/login and resume correct stage
- ✅ User can review/correct completed earlier stages
- ✅ Future stage URLs blocked with appropriate error message

### Phase 1 Verified When:

- ✅ All success criteria met
- ✅ Smoke tests completed with fresh allowlisted user
- ✅ Deployment approved by team
- ✅ Ready to transition to Phase 2 (real file upload)

---

## 🎯 Next Steps After Phase 1 Verification

### Immediate (Phase 2)
- Implement real file upload: DOCX/PDF parsing
- Add file upload mode to CvIntakeStage

### Short-term (Phase 3)
- Implement manual job import
- Add job description paste field to JobDiscoveryStage

### Medium-term (Phase 4)
- Implement cover letter AI generation
- Update ApplicationPackStage with generate button
- Add cover letter approval workflow

### Long-term (Phase 5)
- Live pilot launch
- Collect 2-week observation data
- Iterate based on pilot feedback

---

## 📞 Troubleshooting

### Issue: User redirected to wrong stage after login
**Check**: `/api/auth/login` calling `resolveLoginRedirectStage()` correctly
**Verify**: `current_stage` in career_activation_states is set correctly

### Issue: Stage transition not working
**Check**: POST `/api/career/stage-transition` receiving correct userId
**Verify**: `validateStageTransition()` in activationContinuity.ts allows transition

### Issue: Refresh causes data loss
**Check**: journeyState loading correctly from DB
**Verify**: completed_stages array properly serialized in DB

### Issue: Earlier stages not accessible
**Check**: Layout logic in `/app/career-activation/[stage]/layout.tsx`
**Verify**: completedStages array includes stage being accessed

### Issue: Build errors
**Check**: All `.ts` extensions on local imports present
**Verify**: No circular dependency issues in service imports

---

## 📝 Deployment Checklist (Copy for actual deployment)

```
Phase 1 Deployment Checklist - 2026-07-14

PRE-DEPLOYMENT:
☐ TypeScript build complete (npm run build:compile)
☐ Production build complete (npm run build:generate)
☐ Code committed to git
☐ All tests passing
☐ Migration file reviewed

DEPLOYMENT:
☐ Apply migration to Supabase (career_activation_states extensions)
☐ Verify new tables in Supabase: career_journey_state, cover_letter_generations
☐ Deploy to Vercel (git push or manual trigger)
☐ Verify deployment successful (0 errors)
☐ Check Vercel environment variables set correctly

POST-DEPLOYMENT VERIFICATION:
☐ Test Scenario 1: Full journey (signup → all 9 stages → dashboard)
☐ Test Scenario 2: Refresh at multiple stages
☐ Test Scenario 3: Logout/login resume journey
☐ Test Scenario 4: URL blocking (future stages)
☐ Test Scenario 5: Earlier stages accessible
☐ Test Scenario 6: Application pack requirements
☐ Test Scenario 7: Session persistence
☐ Test Scenario 8: Error handling

PRODUCTION VERIFICATION:
☐ Production logs show no errors
☐ Career activation routes functioning
☐ Auth login redirects working correctly
☐ Database queries successful

SIGN-OFF:
☐ Phase 1 production-complete and verified
```
