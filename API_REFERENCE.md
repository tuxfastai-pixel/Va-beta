# Phase 6 API Reference Card

## 🔌 All Endpoints & Functions

### Priority & Alert APIs

**1. Priority Engine**
```typescript
import { getPriorityLevel, getAlertableJobs } from '@/lib/ai/priorityEngine';

// Get priority level for a job
const level = getPriorityLevel(job); // "critical" | "high" | "medium" | "low"

// Get jobs worth alerting about
const jobs = await getAlertableJobs(allJobs); // critical + high only
```

**2. Auto-Apply Logic**
```typescript
import { shouldAutoApply, canAutoApply, isAutoApplySafe } from '@/lib/ai/autoApplyEngine';

// Check if job meets auto-apply criteria
const canApply = shouldAutoApply(job); // score >= 8, remote, no portfolio req

// Check daily/monthly limits
const hasCapacity = canAutoApply(stats); // 20/day, 400/month

// Combined safety check
const isSafe = isAutoApplySafe(job, stats);

// Why was it rejected?
const reason = getAutoApplyReason(job, stats);
```

**3. Escalation Engine**
```typescript
import { buildEscalationQueue, getEscalationReasons } from '@/lib/ai/escalationEngine';

// Build queue for manual dashboard
const queue = buildEscalationQueue(jobs); // score 7-9 with triggers

// Why is this escalated?
const reasons = getEscalationReasons(job); // ["portfolio", "high_pay", "etc"]
```

### REST APIs (HTTP)

**4. Escalation Endpoint**
```bash
GET /api/escalation

# Response:
{
  "jobs": [
    {
      "id": "job-123",
      "title": "Senior Dev",
      "score": 8.2,
      "escalationReasons": ["requiresPortfolio", "budgetOver2000"],
      "manualActionRequired": "Review portfolio requirements",
      "link": "https://indeed.com/...",
      "budget": 2500,
      "remote": true,
      "type": "full-time"
    }
  ],
  "summary": {
    "total": 18,
    "high": 12,    // score >= 8
    "medium": 6    // score 7-8
  }
}
```

**5. Contracts - Sign Endpoint**
```bash
POST /api/contracts/sign

Body:
{
  "contractId": "uuid",
  "name": "Client Name"
}

# Response:
{
  "success": true,
  "contractId": "uuid",
  "signedAt": "2024-01-15T10:30:00Z",
  "signerIp": "192.168.1.1",
  "status": "signed"
}
```

**6. Portal Endpoint**
```bash
GET /api/portal

# Response:
{
  "contracts": [
    {
      "id": "contract-uuid",
      "dealTitle": "Project Name",
      "status": "draft",
      "createdAt": "2024-01-01",
      "content": "Contract text..."
    }
  ],
  "invoices": [
    {
      "id": "invoice-uuid",
      "number": "INV-20240115-0001",
      "amount": 5000,
      "currency": "USD",
      "status": "pending",
      "dueDate": "2024-01-22",
      "paymentLink": "https://payfast.io/...",
      "createdAt": "2024-01-15"
    }
  ]
}
```

### CRM APIs

**7. Client Manager**
```typescript
import { createClient, getOrCreateClient, updateClient } from '@/lib/crm/clientManager';

// Create new client
const client = await createClient({
  name: "Acme Corp",
  email: "contact@acme.com",
  phone: "+1234567890",
  region: "US",
  source: "website"
});

// Get or create (deduplicates by email)
const client = await getOrCreateClient({
  name: "Same Corp",
  email: "contact@acme.com"
}); // Returns existing client

// Update client
await updateClient(clientId, { phone: "+9876543210" });
```

**8. Deal Manager**
```typescript
import { createDeal, moveStage, getPipelineValue } from '@/lib/crm/dealManager';

// Create deal
const deal = await createDeal({
  clientId: "uuid",
  title: "Website Project",
  value: 10000,
  stage: "lead"
}); // Auto-sets probability (lead = 20%)

// Move deal through pipeline
await moveStage(dealId, "interview"); // probability updates to 60%
await moveStage(dealId, "negotiation"); // probability = 80%
await moveStage(dealId, "closed_won"); // probability = 100%

// Get pipeline metrics
const value = await getPipelineValue();
// {
//   total: 150000,
//   byStage: { lead: 20000, negotiation: 80000, closed_won: 50000 }
// }
```

**9. Activity Logger**
```typescript
import { logActivity } from '@/lib/crm/activityManager';

await logActivity({
  dealId: "uuid",
  type: "call",
  note: "Discussed project timeline",
  metadata: { duration: 15, outcome: "positive" }
});
```

### Interview & Conversation APIs

**10. Interview Engine**
```typescript
import { generateAnswer, getQuestionType } from '@/lib/interview/interviewEngine';

// Generate answer to interview question
const answer = generateAnswer(
  "Tell me about your admin experience",
  { primaryCareer: "admin" }
);
// Result: "I focus on structured workflow management, accurate data handling..."

// Identify question type
const type = getQuestionType("What's your biggest weakness?"); // "weakness"

// Context-aware enhancement
const enhanced = enhanceAnswer(answer, { confidence: "high" });
```

**11. Conversation State Machine**
```typescript
import { getStage, respond } from '@/lib/conversation/stateMachine';

// Detect conversation stage
const stage = getStage(message); // "interview" | "negotiation" | "closing"

// Get AI response
const response = respond(message, {
  stage: "interview",
  primaryCareer: "admin",
  jobTitle: "Office Manager"
});
```

**12. Closing Engine**
```typescript
import { detectClosingSignal, handlePricePushback } from '@/lib/closing/closingEngine';

// Is client ready to close?
const signal = detectClosingSignal("Okay, when can you start?"); // true

// Handle price objection
const response = handlePricePushback(5000, { proposedPrice: 6000 });
// "I understand budget constraints. We can adjust scope..."
```

### Follow-up & Billing APIs

**13. Follow-up Engine**
```typescript
import { buildFollowUpBatch } from '@/lib/followups/followupEngine';

// Queue follow-ups for orchestrator
const followUps = await buildFollowUpBatch(applications);
// Schedules day 2, 5, 10 follow-ups automatically
```

**14. Recurring Billing**
```typescript
import { createSubscription, processRecurringBilling } from '@/lib/billing/recurring';

// Create subscription
const sub = await createSubscription({
  clientId: "uuid",
  amount: 500,
  interval: "monthly",
  startDate: new Date()
});

// Process billing (called by orchestrator daily)
const result = await processRecurringBilling();
// Creates invoices for subscriptions with next_billing_date <= today
```

### Payment & Invoice APIs

**15. Invoice Generation**
```typescript
import { createInvoice, generatePaymentLink } from '@/lib/invoices/generator';

// Create invoice
const invoice = await createInvoice({
  dealId: "uuid",
  amount: 5000,
  description: "Website Development - Phase 1",
  clientEmail: "client@acme.com",
  region: "ZA"
});

// Get payment methods
const methods = await getPaymentInstructions("ZA");
// Returns: PayFast link, Wise link, bank transfer details
```

**16. Payment Links**
```typescript
import { generatePaymentLink } from '@/lib/payments/linkGenerator';

// Generate region-aware payment link
const link = generatePaymentLink(5000, "ZA"); // PayFast
// "https://www.payfast.io/eng/process?merchant_id=..."

const link = generatePaymentLink(5000, "US"); // Wise
// "https://wise.com/pay?amount=5000&targetCurrency=USD"
```

### Contracts & E-Signature

**17. Contract Generation**
```typescript
import { createContract, signContract } from '@/lib/contracts/generator';

// Create contract
const contract = await createContract({
  dealId: "uuid",
  clientName: "Acme Corp",
  content: "..."
});

// Sign contract (called by /api/contracts/sign)
await signContract(contractId, "John Doe", "192.168.1.1");
// Records: timestamp + signer name + IP
// Legally acceptable for most service agreements
```

### Client Portal Components

**18. Portal Page**
```tsx
// Route: /portal

// Shows:
// - Contracts tab (draft/sent/signed/expired)
// - Invoices tab (pending/paid/overdue)
// - Download buttons
// - "Pay Now" links
```

### Dashboard Components

**19. Escalation Dashboard**
```tsx
// Route: /dashboard/escalation

// Shows:
// - Total jobs (all escalations)
// - High value (score >= 8)
// - Medium value (score 7-8)
// - Filter buttons
// - Job cards with escalation reasons
// - "View Job" button
// - "Save to CRM" button
```

## 🔐 Authentication

All endpoints except portal are secured with Bearer token:

```bash
curl https://your-domain.com/api/escalation \
  -H "Authorization: Bearer $CRON_SECRET"
```

Portal is public (should add auth in production):
```bash
curl https://your-domain.com/api/portal
```

## 📊 Common Usage Patterns

**Pattern 1: Auto-apply with logging**
```typescript
if (isAutoApplySafe(job, stats)) {
  // Apply to job
  const application = await applyToJob(job);

  // Log to auto_applications table
  await supabaseServer
    .from('auto_applications')
    .insert({
      job_id: job.id,
      job_title: job.title,
      platform: job.platform,
      status: "applied"
    });
}
```

**Pattern 2: Escalation with dashboard**
```typescript
// Build queue
const escalations = buildEscalationQueue(jobs);

// Log to escalations table
for (const esc of escalations) {
  await supabaseServer
    .from('escalations')
    .insert({
      job_id: esc.id,
      score: esc.score,
      reasons: esc.reasons
    });
}

// Client visits /dashboard/escalation to review
```

**Pattern 3: Deal to invoice workflow**
```typescript
// Create client
const client = await getOrCreateClient(clientData);

// Create deal
const deal = await createDeal({
  clientId: client.id,
  title: "Website Project",
  value: 10000,
  stage: "lead"
});

// Generate contract
const contract = await createContract({
  dealId: deal.id,
  clientName: client.name
});

// Move deal to negotiation
await moveStage(deal.id, "negotiation"); // probability: 80%

// Create invoice
const invoice = await createInvoice({
  dealId: deal.id,
  amount: 10000,
  description: "Website Development - Full Project"
});

// Client pays via link
// Payment webhook marks invoice as paid
// Orchestrator detects paid status and sends thank you
```

**Pattern 4: Conversation flow**
```typescript
// Message comes in from Slack/WhatsApp
const message = "How much would you charge for a website?";

// Detect stage
const stage = getStage(message); // "negotiation"

// Get appropriate response
const response = respond(message, conversationState);
// Returns price negotiation response

// Update conversation state
await updateConversationState(conversationId, {
  stage,
  message,
  response
});

// Send response back to client
await sendViaSlack(response);
```

## 💾 Environment Variables

Required:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key
CRON_SECRET=your_secret
```

Optional (for payments):
```env
PAYFAST_MERCHANT_ID=merchant_id
PAYFAST_MERCHANT_KEY=merchant_key
WISE_ACCOUNT_NUMBER=account_number
BANK_ACCOUNT_NUMBER=your_bank_account
BANK_CODE=250655
```

## 🧪 Quick Tests

```bash
# Test priority engine
npx ts-node -e "
import { getPriorityLevel } from './lib/ai/priorityEngine';
console.log(getPriorityLevel({score: 9.5}));
"

# Test escalation endpoint
curl http://localhost:3000/api/escalation -H "Authorization: Bearer test_secret"

# Test portal
curl http://localhost:3000/api/portal

# Run all tests
npm run test

# Run load test
k6 run tests/orchestrator-load.ts
```

---

**All functions are fully typed with TypeScript. Hover in your editor for autocomplete!**
