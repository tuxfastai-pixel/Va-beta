# AGENTS

## Autonomous Agent Orchestrator

You are an autonomous multi-agent engineering system.

Agents collaborate sequentially to implement features safely, incrementally, and with verification.

### Agents
1. Architect Agent
2. Planner Agent
3. Engineer Agent
4. Reviewer Agent
5. Test Agent
6. Optimizer Agent

### Core Constraints
- Preserve existing functionality
- Do not modify node_modules or generated files
- Prefer small incremental diffs
- Ensure TypeScript builds
- Maintain modular architecture
- Ensure API routes compile

## Repository Overview

### Modules
- /app/api -> Backend endpoints (task intake, telemetry, health, worker status)
- /workers -> Autonomous worker entry points and loop runners
- /lib -> Shared utilities, agents, queues, cache, billing, notifications, jobs
- /supabase -> Database migration layer
- /app/dashboard and /app/clients -> Frontend dashboards

### Worker Tasks
- JOB_DISCOVERY
- JOB_MATCHING
- JOB_APPLICATION
- COMPLIANCE_TASK
- BOOKKEEPING_TASK
- DOCUMENT_PROCESSING

### Primary Queue Consumer
- workers/aiWorker.ts is the primary consumer for worker_tasks
- workers/workerLoop.ts is legacy and disabled by default

## Agent Responsibilities

### Architect Agent
- Map architecture
- Identify modules and dependencies
- Detect missing components
- Detect scaling risks and bottlenecks
- Output: architecture diagram (text) and module list

### Planner Agent
- Produce step-by-step implementation plan
- Include files to create/modify, DB migrations, worker processes, API endpoints, caching, observability, and tests
- Minimize risk and avoid large refactors

### Engineer Agent
- Implement incrementally (one module at a time)
- Keep imports/types consistent
- Run build checks after major changes
- Implement worker tasks safely

### Reviewer Agent
- Inspect for logical errors, race conditions, edge cases, query issues, security issues, inefficiencies, and API contract drift
- Recommend fixes before continuation

### Test Agent
- Verify TypeScript build
- Validate API routes
- Validate DB migrations
- Validate worker task execution and edge cases

### Optimizer Agent
- Improve cache usage
- Improve indexing and query performance
- Remove redundant queries
- Optimize worker loops and memory behavior

## Orchestration Order
Architect -> Planner -> Engineer -> Reviewer -> Test -> Optimizer

If issues are found:
- Reviewer -> Engineer
- Test -> Engineer
- Optimizer -> Engineer

Repeat until stable.

## Standard Delivery Format
1. Architecture summary
2. Files modified
3. Files created
4. Database migrations
5. New endpoints
6. Worker tasks added/changed
7. Deployment next steps

## Execution Commands

Use these commands during implementation and verification phases.

### Setup
- npm install

### Build and Lint
- npm run build
- npm run lint

### Local App Runtime
- npm run dev
- npm run start

### Worker Processes
- npm run worker:ai
- npm run worker:ai-manager
- npm run worker
- npm run worker:discovery
- npm run worker:applications
- npm run worker:tasks
- npm run worker:outreach
- npm run worker:planner
- npm run autonomous

### Optional Supabase Migration Commands
Use only if Supabase CLI is installed and project is linked.
- supabase migration list
- supabase db push
- supabase db reset

## Phase Checklists with Commands

### Architect Phase (read-only)
- Map modules from app, lib, workers, supabase, types
- Confirm queue consumer ownership before edits

### Planner Phase (read-only)
- Identify files to modify/create
- Identify required SQL migration files under supabase/migrations

### Engineer Phase (incremental)
- Apply one module change at a time
- After major change: run npm run build

### Reviewer Phase
- Inspect changed files for logic/race/security/query issues
- Validate API contract shape and worker task state transitions

### Test Phase
- Run npm run build
- Run npm run lint
- Start app/worker process needed for manual endpoint validation

### Optimizer Phase
- Confirm indexes exist for hot queries
- Confirm cache usage for repeated reads
- Ensure worker idle loops are bounded and wake-driven where possible
