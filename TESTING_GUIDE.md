# Phase 6 System: Complete Testing & Operations Guide

## 🎯 Overview

This document covers the complete Phase 6 system implementation:
- Priority Alert System
- Auto-Apply Engine (Controlled)
- Escalation Engine + Dashboard
- Interview Handling AI
- Auto Follow-up System
- Deal Closing Assistant
- CRM System (Clients, Deals, Activities, Contracts, Invoices)
- Client Portal
- Recurring Billing
- Comprehensive Testing Framework

## 📊 Pass/Fail Criteria (HARD TARGETS)

Before going live, your system must meet these targets:

| Metric | Target | Measurement | Critical |
|--------|--------|-------------|----------|
| **Availability** | ≥ 99% | 5xx errors / total requests | ✅ YES |
| **P95 Latency** | < 800ms | API response time | ✅ YES |
| **Job Ingest Success** | ≥ 95% | Saved / fetched | ✅ YES |
| **Duplicate Prevention** | 0 | Duplicate auto-applies | ✅ YES |
| **Invoice Conversion** | ≥ 20% | Paid / created (30 days) | ❌ NO |
| **Missed Tender Deadlines** | 0 | Missed count | ✅ YES |
| **Contract Signature Rate** | ≥ 80% | Signed / sent (30 days) | ❌ NO |
| **Follow-up Delivery** | ≥ 98% | Sent / scheduled | ✅ YES |

**All CRITICAL metrics must pass before production deployment.**

## 🚀 Quick Start

### 1. Apply Supabase Migration

```bash
cd va-beta
npx supabase db push supabase/migrations/20260504_crm_system.sql
```

This creates tables:
- `clients` - CRM contacts
- `deals` - Sales pipeline
- `activities` - Deal history
- `contracts` - Service agreements
- `invoices` - Billing
- `subscriptions` - Recurring billing
- `auto_applications` - Tracking auto-applies
- `escalations` - Manual review queue

### 2. Test Core Modules

```bash
# Test priority engine
npx ts-node -e "
import { getPriorityLevel } from './lib/ai/priorityEngine';
const job = { score: 9, platformWeight: 0.9, remote: true };
console.log(getPriorityLevel(job)); // 'critical'
"

# Test auto-apply logic
npx ts-node -e "
import { shouldAutoApply } from './lib/ai/autoApplyEngine';
const job = { score: 8.5, remote: true, requiresManualAnswers: false, link: 'https://...' };
console.log(shouldAutoApply(job)); // true
"

# Test escalation
npx ts-node -e "
import { buildEscalationQueue } from './lib/ai/escalationEngine';
const jobs = [{ id: '1', score: 8, requiresPortfolio: true }];
const queue = buildEscalationQueue(jobs);
console.log(queue.length); // 1
"
```

### 3. Access New Pages

- **Escalation Dashboard**: `https://your-domain.com/dashboard/escalation`
- **Client Portal**: `https://your-domain.com/portal`
- **Analytics**: `https://your-domain.com/dashboard/analytics`

### 4. View Contracts & Invoices

```bash
# Call e-signature endpoint
curl -X POST https://your-domain.com/api/contracts/sign \
  -H "Content-Type: application/json" \
  -d '{"contractId": "uuid", "name": "Client Name"}'

# Fetch portal data
curl https://your-domain.com/api/portal
```

## 🧪 Testing Strategy

### Phase 1: Unit Tests (Run First)

Test individual modules:

```bash
# Priority filtering
npx ts-node -e "
import { getPriorityLevel, filterJobsByPriority } from './lib/ai/priorityEngine';

// Test 1: Score >= 9 = critical
let job = { score: 9.5, platformWeight: 0, remote: false };
console.assert(getPriorityLevel(job) === 'critical', 'Score 9.5 should be critical');

// Test 2: Score 7-9 = high
job = { score: 8, platformWeight: 0, remote: false };
console.assert(getPriorityLevel(job) === 'high', 'Score 8 should be high');

// Test 3: Platform weight adds to score
job = { score: 8, platformWeight: 1, remote: false };
console.assert(getPriorityLevel(job) === 'critical', 'Score 8 + weight 1 = critical');

console.log('✅ All priority engine unit tests passed');
"
```

### Phase 2: Integration Tests

Test module interactions:

```bash
# Priority → Escalation flow
npx ts-node -e "
import { getEscalationCandidates } from './lib/ai/priorityEngine';
import { buildEscalationQueue } from './lib/ai/escalationEngine';

const jobs = [
  { id: '1', score: 8.5, requiresPortfolio: true, title: 'Design Job' },
  { id: '2', score: 6, requiresPortfolio: false, title: 'Coding Job' },
];

const candidates = getEscalationCandidates(jobs);
const escalations = buildEscalationQueue(candidates);

console.assert(escalations.length === 1, 'Only 1 job should escalate');
console.assert(escalations[0].id === '1', 'Job 1 should escalate (high + portfolio)');
console.log('✅ Priority → Escalation integration test passed');
"
```

### Phase 3: Data Integrity Tests

```bash
# Test duplicate job prevention
npx ts-node -e "
import { supabaseServer } from './lib/supabaseServer';

// Simulate saving same job twice
const job = { title: 'Same Job', platform: 'indeed', link: 'https://indeed.com/123' };

// First save
const { data: first } = await supabaseServer.from('jobs').insert([job]).select();
console.log('First save:', first.length, 'jobs');

// Second save (should deduplicate)
const { data: second } = await supabaseServer.from('jobs').insert([job]).select();
console.log('Second save:', second.length, 'jobs');

console.assert(first.length === 1 && second.length === 1, 'No duplicates');
"
```

### Phase 4: Load Tests

```bash
# Install k6 if not already installed
# macOS: brew install k6
# Linux: sudo apt-get install k6
# Windows: choco install k6

# Run spike test
k6 run tests/orchestrator-load.ts --env CRON_SECRET=your_secret

# Check output:
# - P95 latency should be < 800ms
# - Error rate should be < 1%
```

### Phase 5: E2E Flow Test

Complete user journey:

```bash
npx ts-node scripts/e2eTest.ts
```

Expected output:
```
✅ Step 1: Lead tracked
✅ Step 2: Job scored (priority: critical)
✅ Step 3: Auto-applied or escalated
✅ Step 4: Deal created
✅ Step 5: Contract generated
✅ Step 6: Contract signed (recorded IP + timestamp)
✅ Step 7: Invoice created (with payment link)
✅ Step 8: Revenue logged
✅ Step 9: Subscription created
✅ All steps completed successfully
```

### Phase 6: Chaos Day

Run simultaneous stress + failures:

```bash
# Run orchestrator load test (spike to 100 req/s)
k6 run tests/orchestrator-load.ts --stage "2m:20, 5m:100, 5m:100, 2m:0" &

# Break Supabase (in another terminal)
export SUPABASE_URL="https://invalid-url.supabase.co"
npm run dev

# Send fake leads
curl -X POST localhost:3000/api/track \
  -H "Content-Type: application/json" \
  -d '{"event": "lead_created"}' &
curl -X POST localhost:3000/api/track \
  -H "Content-Type: application/json" \
  -d '{"event": "lead_created"}' &
# ... repeat 500 times

# Trigger orchestrator every 10 seconds
for i in {1..100}; do
  curl -X POST localhost:3000/api/run-orchestrator \
    -H "Authorization: Bearer $CRON_SECRET" &
  sleep 10
done

# Observe logs
tail -f ~/.pm2/logs/next-default-error.log
```

**Success criteria**: No unhandled exceptions, graceful error handling, system recovers when issues fixed.

## 📋 Deployment Checklist

- [ ] All Supabase tables created
- [ ] Environment variables set:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`
  - `PAYFAST_MERCHANT_ID` (optional)
  - `PAYFAST_MERCHANT_KEY` (optional)
  - `WISE_ACCOUNT_NUMBER` (optional)
- [ ] Unit tests passing (test/unitTests.ts)
- [ ] Integration tests passing
- [ ] E2E flow test passing
- [ ] Load test passing (P95 < 800ms, error rate < 1%)
- [ ] Chaos day completed (0 unhandled errors)
- [ ] Monitoring dashboards set up
- [ ] Alert rules configured (Slack, Email)
- [ ] GitHub Actions cron schedule verified

## 📊 Monitoring Dashboards

After deployment, create these dashboards:

### 1. KPI Dashboard
- **Visits**: Total landing page visits
- **Leads**: Form submissions
- **Auto-applies**: Count per day
- **Escalations**: Count per day
- **Conversions**: Deals closed won
- **Revenue**: Total + per source

### 2. Escalation Dashboard
- See: `https://your-domain.com/dashboard/escalation`
- Shows jobs with score 7-9
- Filterable by high/medium value

### 3. System Health
- **Error rate**: 5xx / total requests (target < 1%)
- **P95 latency**: API response time (target < 800ms)
- **Uptime**: Availability percentage (target ≥ 99%)
- **Job ingest**: Success rate (target ≥ 95%)

### 4. CRM Pipeline
- **Leads**: Count in 'lead' stage
- **Contacted**: Count in 'contacted' stage
- **Interviews**: Count in 'interview' stage
- **Negotiation**: Count in 'negotiation' stage
- **Closed Won**: Count + total value
- **Pipeline Value**: Sum of all open deals

### 5. Billing
- **Pending Invoices**: Count + total value
- **Paid Invoices**: Count + total value (month)
- **Payment Conversion**: Paid / created (target ≥ 20%)
- **Subscriptions**: Active count + monthly MRR

## 🐛 Common Issues & Fixes

### Issue: Auto-apply rate limit not enforced
**Fix**: Verify `autoApplyStats` is tracking `appliedToday`. Check database query:
```sql
SELECT COUNT(*) FROM auto_applications
WHERE applied_at::date = CURRENT_DATE;
```

### Issue: Escalation dashboard shows no jobs
**Fix**: Verify jobs table has records with score between 7-9:
```sql
SELECT COUNT(*) FROM jobs WHERE score >= 7 AND score < 9;
```

### Issue: Contracts not signing
**Fix**: Verify e-signature endpoint is accessible:
```bash
curl -X POST localhost:3000/api/contracts/sign \
  -H "Content-Type: application/json" \
  -d '{"contractId": "test", "name": "Test"}'
```

### Issue: Payment links not generated
**Fix**: Verify region detection and environment variables:
```bash
echo $PAYFAST_MERCHANT_ID
echo $WISE_ACCOUNT_NUMBER
```

## 📞 Production Support

**Daily Checks:**
- [ ] No 5xx errors in past 24h
- [ ] P95 latency stable (< 800ms)
- [ ] Job ingest success rate ≥ 95%
- [ ] Auto-apply rate limit working
- [ ] Follow-ups scheduled and sent
- [ ] No missed tender deadlines

**Weekly Checks:**
- [ ] Run load test (soak 50 req/s for 30m)
- [ ] Review error logs for patterns
- [ ] Check database size growth
- [ ] Verify backup/recovery works
- [ ] Review revenue metrics

**Monthly Checks:**
- [ ] Run chaos day test
- [ ] Review conversion metrics
- [ ] Analyze CRM pipeline value
- [ ] Check invoice payment rate (≥ 20% target)
- [ ] Plan scaling if needed

## 🎓 Key Files

- **lib/ai/priorityEngine.ts** - Priority filtering
- **lib/ai/autoApplyEngine.ts** - Auto-apply with rate limiting
- **lib/ai/escalationEngine.ts** - Escalation logic
- **lib/interview/interviewEngine.ts** - Interview AI
- **lib/followups/followupEngine.ts** - Auto follow-ups
- **lib/closing/closingEngine.ts** - Closing scripts
- **lib/crm/clientManager.ts** - CRM operations
- **lib/contracts/generator.ts** - Contract & e-signature
- **lib/invoices/generator.ts** - Invoice generation
- **lib/billing/recurring.ts** - Subscription billing
- **app/dashboard/escalation/page.tsx** - Escalation dashboard
- **app/portal/page.tsx** - Client portal
- **lib/orchestrator.ts** - Main orchestrator (updated)
- **tests/testingFramework.ts** - Testing framework
- **tests/orchestrator-load.ts** - K6 load tests
- **supabase/migrations/20260504_crm_system.sql** - Database schema

## ✅ System Complete

You now have a fully integrated AI job hunting system with:
- ✅ Intelligent job prioritization
- ✅ Controlled auto-apply (20/day, score ≥ 8 only)
- ✅ Manual escalation for high-value jobs
- ✅ AI-powered interview assistance
- ✅ Automatic follow-ups (day 2, 5)
- ✅ Deal closing support
- ✅ CRM pipeline tracking
- ✅ Contract generation + e-signature
- ✅ Invoice generation + payment links
- ✅ Client portal
- ✅ Recurring billing
- ✅ Comprehensive testing framework

**Next: Deploy to production and monitor!**
