# 🚀 Production Deployment Checklist - Phase 6

## Pilot-Critical Migration Gates (Current)

### 1) Apply New Continuity Migrations

- [ ] `supabase/migrations/20260606_create_career_profiles.sql`
- [ ] `supabase/migrations/20260606_create_runtime_state_tables.sql`
- [ ] `supabase/migrations/20260606_create_continuity_tables.sql`

### 2) Verify Readiness

- [ ] Run:
  ```bash
  npm run check:pilot-readiness
  ```
- [ ] Confirm all checks return `PASS`.

### 3) Run Persistence Smoke Test

- [ ] Run:
  ```bash
  npm run smoke:persistence
  ```
- [ ] Confirm all smoke checks return `PASS`.

### 4) Vercel Env Parity

- [ ] Mirror required keys from `.env.example` to Vercel Project Settings -> Environment Variables.
- [ ] Re-run readiness check in deployment context.

### 5) Controlled Pilot Launch

- [ ] Deploy.
- [ ] Create 3 pilot users.
- [ ] Run 2-week pilot with onboarding -> recommendation -> accept/reject -> interview coaching loop.

## Pre-Deployment (48 Hours Before)

### Database Setup
- [ ] Supabase project created
- [ ] Service role key copied
- [ ] Migration file reviewed: `supabase/migrations/20260504_crm_system.sql`
- [ ] Test migration locally:
  ```bash
  npx supabase db push supabase/migrations/20260504_crm_system.sql
  ```
- [ ] Verify 8 tables created:
  - [ ] `clients`
  - [ ] `deals`
  - [ ] `activities`
  - [ ] `contracts`
  - [ ] `invoices`
  - [ ] `subscriptions`
  - [ ] `auto_applications`
  - [ ] `escalations`

### Environment Variables
- [ ] Create `.env.production`:
  ```env
  SUPABASE_URL=your_url
  SUPABASE_SERVICE_ROLE_KEY=your_key
  CRON_SECRET=generate_strong_secret
  ```
- [ ] Optional payment integrations:
  - [ ] `PAYFAST_MERCHANT_ID` (if using PayFast)
  - [ ] `PAYFAST_MERCHANT_KEY` (if using PayFast)
  - [ ] `WISE_ACCOUNT_NUMBER` (if using Wise)
  - [ ] `BANK_ACCOUNT_NUMBER` (for fallback)

### Code Review
- [ ] All TypeScript errors resolved (0 errors):
  ```bash
  npm run type-check
  ```
- [ ] All ESLint warnings resolved:
  ```bash
  npm run lint
  ```
- [ ] Security review:
  - [ ] API routes use Bearer token auth
  - [ ] No credentials in code
  - [ ] CORS configured if needed
  - [ ] Rate limiting in place

### Testing (Local)

**Unit Tests**
- [ ] Priority engine tests pass
- [ ] Auto-apply logic tests pass
- [ ] Escalation engine tests pass
- [ ] Interview engine tests pass
- [ ] CRM manager tests pass
- [ ] Invoice generation tests pass
- [ ] Contract generation tests pass

**Integration Tests**
- [ ] Priority → Escalation flow works
- [ ] Auto-apply → Follow-up flow works
- [ ] Deal → Contract → Invoice flow works
- [ ] Recurring billing → Invoice flow works

**Manual Tests (Local)**
- [ ] Visit `/dashboard/escalation` - loads without errors
- [ ] Visit `/portal` - loads without errors
- [ ] Test escalation endpoint:
  ```bash
  curl http://localhost:3000/api/escalation \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
- [ ] Test contract signing endpoint (with real contract ID):
  ```bash
  curl -X POST http://localhost:3000/api/contracts/sign \
    -H "Content-Type: application/json" \
    -d '{"contractId": "test-uuid", "name": "Test Client"}'
  ```
- [ ] Test portal endpoint:
  ```bash
  curl http://localhost:3000/api/portal
  ```

## Deployment Day

### 1. Vercel Deployment
- [ ] Code pushed to main branch
- [ ] GitHub Actions triggered
- [ ] Build completes without errors:
  - [ ] TypeScript compilation ✅
  - [ ] Next.js build ✅
  - [ ] ESLint ✅
- [ ] Production environment variables set in Vercel dashboard:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `CRON_SECRET`
  - [ ] Optional payment vars

### 2. Supabase Production Migration
- [ ] Connect to production Supabase:
  ```bash
  npx supabase link --project-ref your_production_project
  ```
- [ ] Apply migration:
  ```bash
  npx supabase db push supabase/migrations/20260504_crm_system.sql
  ```
- [ ] Verify tables exist in SQL editor:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
  ```

### 3. Post-Deployment Validation

**Endpoint Tests**
- [ ] Escalation endpoint returns data:
  ```bash
  curl https://your-domain.com/api/escalation \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
- [ ] Portal endpoint returns data:
  ```bash
  curl https://your-domain.com/api/portal
  ```
- [ ] Contract signing works (with real data):
  ```bash
  curl -X POST https://your-domain.com/api/contracts/sign \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -d '{"contractId": "...", "name": "Test"}'
  ```

**Dashboard Tests**
- [ ] Escalation dashboard loads: `https://your-domain.com/dashboard/escalation`
- [ ] Client portal loads: `https://your-domain.com/portal`
- [ ] Analytics dashboard loads: `https://your-domain.com/dashboard/analytics`

**Database Tests**
- [ ] Query clients table (should be empty initially):
  ```sql
  SELECT COUNT(*) FROM clients;
  ```
- [ ] Query deals table:
  ```sql
  SELECT COUNT(*) FROM deals;
  ```
- [ ] Query escalations table:
  ```sql
  SELECT COUNT(*) FROM escalations;
  ```
- [ ] All tables have proper indexes:
  ```sql
  SELECT * FROM pg_stat_user_indexes;
  ```

### 4. GitHub Actions Cron Verification

- [ ] GitHub Actions secrets set:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `CRON_SECRET`

- [ ] Cron workflows configured in `.github/workflows/`:
  - [ ] Every 15 minutes: `/api/run-orchestrator`
  - [ ] Daily 18:00 UTC: `/api/run-orchestrator`

- [ ] Test cron manually:
  ```bash
  curl -X POST https://your-domain.com/api/run-orchestrator \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

## Post-Deployment (Day 1)

### Monitor Logs
- [ ] No 5xx errors in Vercel logs
- [ ] No TypeScript runtime errors
- [ ] Supabase connection successful
- [ ] All imports resolved correctly

### Test Full Flow (E2E)

**Step 1: Create Client**
```bash
curl -X POST https://your-domain.com/api/crm/clients \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Corp", "email": "test@example.com", "region": "US"}'
```

**Step 2: Create Deal**
```bash
curl -X POST https://your-domain.com/api/crm/deals \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "...", "title": "Project", "value": 5000, "stage": "lead"}'
```

**Step 3: Generate Contract**
```bash
curl -X POST https://your-domain.com/api/contracts \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dealId": "...", "clientName": "Test Corp"}'
```

**Step 4: Generate Invoice**
```bash
curl -X POST https://your-domain.com/api/invoices \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dealId": "...", "amount": 5000, "description": "Project"}'
```

**Step 5: Visit Portal**
- Open: `https://your-domain.com/portal`
- [ ] See contract in "Contracts" tab
- [ ] See invoice in "Invoices" tab with payment link
- [ ] Payment link is clickable (PayFast or Wise)

**Step 6: Sign Contract**
```bash
curl -X POST https://your-domain.com/api/contracts/sign \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"contractId": "...", "name": "Test Signer"}'
```

- [ ] Verify contract status changed to "signed" in Supabase
- [ ] Verify IP address recorded
- [ ] Verify timestamp recorded

### Verify KPI Dashboard
- [ ] Create analytics dashboard in Supabase:
  ```sql
  SELECT
    COUNT(DISTINCT client_id) as total_clients,
    COUNT(DISTINCT id) as total_deals,
    SUM(value) as pipeline_value
  FROM deals;
  ```

- [ ] Monitor in real-time:
  - [ ] Client count
  - [ ] Deal count
  - [ ] Pipeline value
  - [ ] Escalation count

### Load Test
- [ ] Run spike test (if comfortable):
  ```bash
  k6 run tests/orchestrator-load.ts --vus 10 --duration 5m
  ```
- [ ] P95 latency < 800ms
- [ ] Error rate < 1%

## Controlled Rollout (Required)

### Stage 1 - Internal Only (48-72 Hours)
- [ ] Restrict usage to internal/admin-controlled testers only
- [ ] Enable:
  - [ ] telemetry
  - [ ] personalization
  - [ ] monitoring
  - [ ] governance
  - [ ] recovery
  - [ ] adaptive UI
- [ ] Keep disabled:
  - [ ] autonomous mutation escalation
  - [ ] aggressive adaptation
  - [ ] high-frequency orchestration
- [ ] Verify no continuity regressions in admin intervention timeline and governance logs

### Stage 2 - Passive Adaptive Release
- [ ] Enable:
  - [ ] adaptive workspace morphing
  - [ ] cadence prediction
  - [ ] recovery intelligence
  - [ ] notification orchestration
- [ ] Keep autonomous mutation conservative
- [ ] Monitor drift velocity, trust decay, and recovery-frequency overlays daily

### Stage 3 - Autonomous Regulation Activation
- [ ] Enable:
  - [ ] self-calming
  - [ ] adaptive pacing
  - [ ] equilibrium learning
  - [ ] recovery automation
- [ ] Keep governance kill-switch active and verified
- [ ] Confirm rollback workspace and emergency safe mode are functional in production

## Session Continuity Recovery (Next Major Build)

- [ ] Implement continuity recovery for:
  - [ ] browser crash
  - [ ] mobile disconnect
  - [ ] AI request failure
  - [ ] deployment restart
  - [ ] orchestration reset
- [ ] Restore on resume:
  - [ ] emotional cadence
  - [ ] workspace shape
  - [ ] continuity messaging
  - [ ] recovery state
  - [ ] unfinished trajectory
- [ ] Validate this with composite replay payload tests routed through unified AI gateway

## Post-Deployment (Week 1)

### Daily Checks
- [ ] ✅ No 5xx errors
- [ ] ✅ P95 latency stable
- [ ] ✅ Job ingest success ≥ 95%
- [ ] ✅ Auto-apply rate limit working
- [ ] ✅ Escalations generated
- [ ] ✅ Follow-ups scheduled

### Weekly Checks
- [ ] Run soak test (50 req/s × 30m):
  ```bash
  k6 run tests/orchestrator-load.ts --env TEST_TYPE=soak
  ```
- [ ] Review error logs
- [ ] Check database size
- [ ] Verify backups exist

### Monitoring Setup

**Create Supabase Alerts:**
- [ ] Alert on high error rate (> 1%)
- [ ] Alert on slow queries (> 1000ms)
- [ ] Alert on storage quota (> 80%)

**Create Vercel Alerts:**
- [ ] Alert on 5xx errors
- [ ] Alert on build failures
- [ ] Alert on high latency (> 1000ms)

**Create Custom Alerts (Email/Slack):**
- [ ] No auto-applies today (potential issue)
- [ ] 0 escalations today (no high-value jobs)
- [ ] No conversions this week (check funnel)

## Common Issues & Fixes

### Issue: Orchestrator not running
**Fix:**
```bash
# Check GitHub Actions
curl https://api.github.com/repos/YOUR_ORG/va-beta/actions/workflows

# Manually trigger
curl -X POST https://your-domain.com/api/run-orchestrator \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Issue: Supabase connection failing
**Fix:**
```bash
# Check credentials
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection
npx ts-node -e "
import { supabaseServer } from '@/lib/supabaseServer';
const { data } = await supabaseServer.from('clients').select('count(*)');
console.log(data);
"
```

### Issue: Escalation dashboard shows no jobs
**Fix:**
```sql
-- Check if jobs table has data
SELECT COUNT(*) FROM jobs WHERE score >= 7;

-- Check escalations table
SELECT COUNT(*) FROM escalations;
```

### Issue: Payment links not working
**Fix:**
```bash
# Check if PayFast/Wise is configured
echo $PAYFAST_MERCHANT_ID
echo $WISE_ACCOUNT_NUMBER

# Test payment link generation
npx ts-node -e "
import { generatePaymentLink } from '@/lib/payments/linkGenerator';
const link = generatePaymentLink(5000, 'US');
console.log(link);
"
```

## Rollback Plan

If deployment has critical issues:

```bash
# 1. Rollback Vercel
# Go to Vercel dashboard → Deployments → Redeploy previous version

# 2. Rollback database (if needed)
# Go to Supabase → Backups → Restore from snapshot

# 3. Disable cron jobs (if needed)
# Disable workflows in GitHub Actions
```

## Success Criteria

**Deployment is successful when:**
- ✅ All endpoints respond with 200 OK (not 5xx)
- ✅ Escalation dashboard displays jobs
- ✅ Client portal shows contracts/invoices
- ✅ E2E flow (client → contract → invoice) works end-to-end
- ✅ No TypeScript errors in logs
- ✅ No unhandled exceptions
- ✅ P95 latency < 800ms
- ✅ Orchestrator runs on schedule
- ✅ Rate limits enforced (20 auto-applies/day)
- ✅ Duplicate prevention working

**Your system is live when all 10 criteria are met!** 🎉

---

**Deployment Estimated Time: 2-4 hours**

Need help? Check TESTING_GUIDE.md or API_REFERENCE.md
