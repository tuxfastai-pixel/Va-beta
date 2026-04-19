# VA-Beta Architecture

High-level system design and module organization.

## Directory Structure

### `/app`
**Frontend & Next.js server framework**
- `layout.tsx` — Root layout wrapper
- `page.tsx` — Home page
- `globals.css` — Global styles
- `/api` — REST API endpoints
  - `/active-jobs` — Active job listings
  - `/agent` — Agent orchestration (start, autonomous loop)
  - `/ai` — AI model interactions
  - `/applications` — Job applications
  - `/career` — Career roadmap generation
  - `/client` — Client task submission & invoice/payment endpoints
  - `/earnings` — Earnings aggregation
  - `/ingestion` — Job ingestion telemetry & status
  - `/jobs` — Job discovery & ranking
  - `/market` — Market trends
  - `/memory` — AI memory storage
  - `/onboarding` — User interview flow
  - `/progress` — User progress scoring
  - `/reports` — Report generation
  - `/skills` — Skill updates
  - `/system` — System health & diagnostics
  - `/usage` — Usage tracking
  - `/workers` — Worker status & monitoring
- `/clients` — Client dashboard page
- `/dashboard` — Worker/user analytics dashboard
- `/login` — Authentication
- `/results` — Results & reporting
- `/work-page` — Work session interface
- `/workflow` — Workflow state & templates

### `/lib`
**Shared business logic & utilities**
- `agentLoop.ts` — Main agent orchestration loop
- `agentRouter.ts` — Route tasks to specific agents
- `dispatcher.ts` — Task dispatcher
- `interviewAgent.ts` — User interview conductor
- `portfolioAgent.ts` — Portfolio builder
- `profileAgent.ts` — User profile generator
- `queue.ts` — Queue abstraction
- `scheduler.ts` — Job scheduling
- `supabase.ts` — Supabase client (browser)
- `supabaseClient.ts` — Supabase generic client
- `supabaseServer.ts` — Supabase server client
- `taskOrchestrator.ts` — Task orchestration engine
- `workSimulator.ts` — Work simulation & testing
- `/agents` — AI agent implementations
  - `aiWorker.ts` — Main AI worker loop
  - `applicationAgent.ts` — Application decision making
  - `autoApplicationAgent.ts` — Autonomous job application
  - `clientDiscoveryAgent.ts` — Client discovery
  - `globalDiscoveryAgent.ts` — Global job discovery
  - `jobHunterAgent.ts` — Job search & ranking
  - `jobMatcherAgent.ts` — Job-user matching
  - `jobQualityFilter.ts` — Job quality scoring & scam detection
  - `learningAgent.ts` — Skill learning recommendations
  - `negotiationAgent.ts` — Salary negotiation
  - `outreachAgent.ts` — Client outreach
  - `plannerAgent.ts` — Career planning
  - `resumeAgent.ts` — Resume generation
  - `taskExecutor.ts` — Generic task executor
  - `workerMatcher.ts` — Worker-job matching
  - `workflowAgent.ts` — Workflow orchestration
  - `workflowBuilder.ts` — Workflow template builder
  - `/sources` — Job source integrations
- `/ai` — AI module implementations
  - `economicEngine.ts` — Economic modeling
  - `marketSelector.ts` — Market selection strategy
  - `marketStrategyEngine.ts` — Market strategy
  - `regionalWorkflows.ts` — Regional workflow templates
  - `workerScore.ts` — Worker performance scoring
- `/billing` — Billing & invoicing
  - `billingEngine.ts` — Fee calculation & invoice generation
  - `invoiceStorage.ts` — Invoice persistence
  - `paymentLinkGenerator.ts` — Stripe/PayPal link generation
- `/browser` — Browser automation (Playwright)
- `/cache` — Caching layer (Redis)
  - `jobCache.ts` — Job result caching
  - `performanceCache.ts` — General performance cache
  - `userJobDelta.ts` — User-job interaction tracking
- `/capacity` — Capacity management
- `/clients` — Client operations
  - `sendOutreach.ts` — Send client outreach
- `/compliance` — Compliance & legal
  - `complianceWorker.ts` — Compliance document processor
- `/db` — Database queries & operations
- `/jobs` — Job operations
  - `apply.ts` — Apply to job
  - `crawler.ts` — Job source crawlers
  - `discovery.ts` — Job discovery
  - `ingestionPipeline.ts` — Job ingestion pipeline
  - `normalization.ts` — Job data normalization
  - `ranking.ts` — Job ranking engine
- `/notifications` — Notification system
  - `email.ts` — Email notifications
- `/queues` — Queue management (BullMQ)
  - `aiWorkerWakeQueue.ts` — Immediate wake signal for AI workers
  - `applicationQueue.ts` — Application task queue
  - `discoveryQueue.ts` — Discovery task queue
  - `rankingQueue.ts` — Job ranking queue
- `/system` — System utilities
  - `logging.ts` — Centralized logging
- `/tasks` — Task management
- `/utils` — General utilities
- `/workers` — Worker operations
  - `clientTaskWorkers.ts` — Bookkeeping & document processing

### `/workers`
**Autonomous worker processes (Node.js entry points)**
- `autonomousLoop.ts` — Continuous autonomous job discovery & application
- `aiWorker.ts` — Main AI worker consuming worker_tasks DB queue
  - Handles: JOB_DISCOVERY, JOB_MATCHING, JOB_APPLICATION, COMPLIANCE_TASK, BOOKKEEPING_TASK, DOCUMENT_PROCESSING
  - Wake signal listener for immediate task processing
- `aiWorkerManager.ts` — Manages multiple AI worker instances
- `agentWorker.ts` — BullMQ-based agent worker pool
- `applicationsWorker.ts` — Application submission worker pool
- `discoveryWorker.ts` — Job discovery worker pool
- `outreachWorker.ts` — Client outreach worker
- `outreachWorkerRunner.ts` — Outreach runner & orchestrator
- `plannerWorker.ts` — Planning agent worker
- `tasksWorker.ts` — General task worker pool
- `workerLoop.ts` — Legacy task consumer (disabled by default)

### `/supabase`
**Database schema & migrations**
- `/migrations` — SQL migration files
  - `20260315_create_worker_tasks_table.sql` — Main worker queue (pending/in_progress/completed/failed)
  - `20260315_add_task_type_to_worker_tasks.sql` — Task type disambiguation
  - `20260316_expand_worker_task_types.sql` — Support for COMPLIANCE, BOOKKEEPING, DOCUMENT_PROCESSING
  - `20260315_add_quality_fields_to_jobs.sql` — Job quality scoring
  - `20260317_create_invoices_table.sql` — Client invoices
  - `20260317_create_notifications_table.sql` — Notification tracking
  - `20260317_add_client_indexes.sql` — Performance indexes

### `/types`
**TypeScript type definitions**
- Shared interfaces for API requests, database models, and agent I/O

### `/public`
**Static assets**

---

## Key Workflows

### Job Discovery & Ingestion
1. Worker polls `worker_tasks` (JOB_DISCOVERY)
2. Crawls job sources via [lib/jobs/crawler.ts](lib/jobs/crawler.ts)
3. Normalizes & scores jobs in [lib/jobs/ingestionPipeline.ts](lib/jobs/ingestionPipeline.ts)
4. Stores accepted jobs in `jobs` table with quality_score & scam_risk
5. Telemetry available via GET `/api/ingestion/status`

### Job Matching & Application
1. Worker processes JOB_MATCHING task → calls `runAllWorkers()` via [lib/agents/aiWorker.ts](lib/agents/aiWorker.ts)
2. Matcher compares user profile to job requirements
3. Worker processes JOB_APPLICATION task → autonomous application via [lib/agents/autoApplicationAgent.ts](lib/agents/autoApplicationAgent.ts)
4. Records application in `applications` table

### Client Task Submission
1. Client POSTs task (COMPLIANCE_TASK, BOOKKEEPING_TASK, DOCUMENT_PROCESSING) to `/api/client/tasks`
2. Documents uploaded to Supabase Storage
3. Task enqueued in `worker_tasks` with client_id & country
4. AI wake signal sent immediately via Redis
5. Worker picks up task, processes, generates invoice, sends completion notification
6. Client views invoice/payment link via `/api/client/invoices` or dashboard

### Compliance & Document Processing
1. Worker processes COMPLIANCE_TASK from `worker_tasks`
2. Calls [lib/compliance/complianceWorker.ts](lib/compliance/complianceWorker.ts)
3. Extracts transactions, categorizes, generates ledger/VAT/tax reports via OpenAI
4. Invoice auto-generated based on country & document volume
5. Notification sent to client

### Billing & Invoicing
1. On task completion, [lib/billing/billingEngine.ts](lib/billing/billingEngine.ts) calculates fee
2. Fee based on: task complexity, country, document volume
3. Invoice stored in `invoices` table via [lib/billing/invoiceStorage.ts](lib/billing/invoiceStorage.ts)
4. Payment link (Stripe/PayPal) generated via [lib/billing/paymentLinkGenerator.ts](lib/billing/paymentLinkGenerator.ts)
5. Notification queued in `notifications` table

### System Health & Monitoring
1. GET `/api/system/health` returns:
   - Active worker count
   - Pending task count
   - In-progress task count
   - Last crawler run timestamp
2. Supports horizontal scaling with Redis task queue state caching

---

## Data Flow (Simplified)

```
[Client] 
  ↓ (POST task with documents)
[/api/client/tasks]
  ↓ (store docs in Supabase Storage + enqueue)
[worker_tasks table (pending)]
  ↓ (Redis wake signal)
[aiWorker.ts polls & claims]
  ↓ (run task handler)
[compliance/bookkeeping/discovery agents]
  ↓ (compute fee, generate invoice)
[billingEngine.ts, invoiceStorage.ts]
  ↓ (store invoice, notify client)
[notifications table + email]
  ↓
[Client Dashboard (/api/client/invoices, /api/client/tasks)]
  ↓ (view invoice, pay via Stripe/PayPal)
[paymentLinkGenerator.ts → external payment processor]
```

---

## Deployment Notes

### Environment Variables
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin credentials
- `OPENAI_API_KEY` — GPT-4 access for job quality scoring & compliance analysis
- `REDIS_HOST`, `REDIS_PORT` — Redis instance for wake signals & caching
- `STRIPE_SECRET_KEY` — Stripe payment processing (optional)
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` — PayPal integration (optional)
- `CLIENT_API_KEY`, `CLIENT_API_KEYS` — Client API key(s) for POST /api/client/tasks
- `ENABLE_LEGACY_WORKER_LOOP` — Set to "true" to enable legacy workerLoop.ts (default: disabled)

### Worker Execution
- Deploy `workers/aiWorker.ts` as primary task consumer (continuous process)
- Disable `workers/workerLoop.ts` unless legacy compatibility is needed
- Replicate `aiWorker.ts` horizontally for load balancing; all instances poll same `worker_tasks` table
- Each worker competes for tasks via optimistic locking (claimed via status update)

### Scaling
- Redis caching reduces DB load for frequently accessed queries (job rankings, user delta)
- Supabase indexes on `worker_tasks(status, priority, created_at)` and `(client_id, status)` for rapid claiming
- Horizontal worker scaling: add more instances of `aiWorker.ts` across different machines/containers
- Optional: offload CPU-intensive tasks (OpenAI calls) to serverless functions (AWS Lambda, Google Cloud Functions)

---

## Testing & Validation

- **Worker Queue**: Verify task flow via GET `/api/system/health`
- **Job Ingestion**: POST to `/api/ingestion/status` returns quality metrics
- **Client Tasks**: Submit task via `/api/client/tasks`, monitor via `/api/client/tasks` (GET)
- **Invoicing**: Check `/api/client/invoices` after task completion
- **Health**: GET `/api/system/health` for queue depth & worker activity
