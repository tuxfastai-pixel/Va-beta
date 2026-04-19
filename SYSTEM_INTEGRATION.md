# Access Control & Goals Auto-Scaling System

## Overview

This system implements two core features:
1. **Controlled Access System** - Approval-based gating for new users
2. **Goals Auto-Scaling System** - Dynamic income goals with automatic tier upgrades and ambition-driven behavior

---

## Part 1: Controlled Access System

### Architecture

```
User → Request Access → Access Request Stored → Admin Notified
  → Admin Dashboard → Review Requests → Approve/Reject
  → User Status Updated → Access Granted/Denied
```

### Database Schema

**`access_requests` table:**
```sql
id, user_id, email, name, reason, status (pending/approved/rejected), 
reviewed_by, reviewed_at, admin_notes, created_at, updated_at
```

**`users` table additions:**
```sql
access_status (pending/approved/rejected)  -- default 'pending'
```

**`admin_notifications` table:**
```sql
type (access_request/access_approved/access_rejected/system_alert),
user_id, title, message, payload, is_read, created_at
```

### User Flow

1. **New User Signup/Access Request:**
   ```bash
   POST /api/onboarding/request
   {
     "email": "user@example.com",
     "name": "User Name",
     "reason": "I want to earn more"
   }
   ```
   - Creates user record with `access_status = 'pending'`
   - Creates access request record
   - **Notifies admin via:**
     - Email (Gmail/SMTP)
     - WhatsApp (Twilio)
     - In-app notification

2. **Check Access Status:**
   ```bash
   GET /api/onboarding/request?email=user@example.com
   
   Response:
   {
     "status": "pending" | "approved" | "rejected",
     "access": boolean,
     "userId": "uuid"
   }
   ```

3. **Admin Approval:**
   ```bash
   POST /api/admin/approve-user
   {
     "email": "user@example.com",
     "adminNotes": "Approved"
   }
   ```
   - Updates `users.access_status = 'approved'`
   - Updates access request status
   - **Sends approval email to user**

4. **Admin Rejection:**
   ```bash
   POST /api/admin/reject-user
   {
     "email": "user@example.com",
     "reason": "Does not meet criteria",
     "adminNotes": "Rejected"
   }
   ```
   - Updates `users.access_status = 'rejected'`
   - **Sends rejection email to user**

### Admin Dashboard

Access the admin panel at `/admin/access`

Features:
- View pending access requests with user details
- Filter by status (Pending, Approved, Rejected)
- Approve or reject users with optional notes
- See request timestamps and user reasons

### Access Guard Integration

**Checking access in any API:**
```typescript
import { enforceAccess } from "@/lib/access/accessGuard";

export async function GET(req: NextRequest) {
  const userId = "...";
  
  // Check access
  const guardResult = await enforceAccess(userId);
  if (guardResult.error) {
    return NextResponse.json(guardResult, { status: guardResult.status });
  }
  
  // Protected code here
}
```

Or use the simpler check:
```typescript
import { checkAccess } from "@/lib/access/accessGuard";

const hasAccess = await checkAccess(userId);
if (!hasAccess) {
  // Handle denied access
}
```

### Environment Variables Required

```env
# For Email Notifications (Gmail)
NOTIFY_EMAIL=your-admin@gmail.com
NOTIFY_PASSWORD=your-app-password

# For Admin Email
ADMIN_EMAIL=admin@company.com

# For WhatsApp Notifications (Optional)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=+1234567890
ADMIN_WHATSAPP_NUMBER=+1234567890
```

---

## Part 2: Goals Auto-Scaling System

### Concept

Instead of static goals, users have **dynamic, auto-scaling targets** that increase as they achieve milestones:

```
Goal: $1,000
  ↓ (User earns $1,000)
Goal: $2,000 (2x scale)
  ↓ (User earns $2,000)
Goal: $4,000 (2x scale)
  ↓ (User earns $4,000)
Goal: $8,000 (2x scale, elite tier)
```

Each tier unlocks different strategies and niches.

### Tier System

```
Starter ($0-$5K):
  - Niches: teaching, admin, customer_support
  - Applications: 10/day
  - Outreach: 3/day
  - Strategy: High volume, quick wins

Growing ($5K-$10K):
  - Niches: project_management, admin, CRM, bookkeeping
  - Applications: 8/day
  - Outreach: 5/day
  - Strategy: Better clients, higher pricing

High-Income ($10K-$50K):
  - Niches: project_management, CRM, legal_admin, business_analysis
  - Applications: 5/day
  - Outreach: 10/day
  - Strategy: Premium clients, enterprise outreach

Elite ($50K+):
  - Niches: enterprise_strategy, legacy_systems, compliance, technical_leadership
  - Applications: 3/day
  - Outreach: 15/day
  - Strategy: Retainers, long-term contracts, enterprise only
```

### Ambition Levels

Set user ambition to multiplier behavior:

```
Normal (1x multiplier):
  - Steady growth
  - Balanced approach

High (1.5x multiplier):
  - Aggressive scaling
  - 15 apps/day in starter tier

Elite (2x multiplier):
  - Maximum income generation
  - 20 apps/day in starter tier, etc.
```

### Database Schema

**`goals` table:**
```sql
id, user_id, goal_type (income/jobs/reputation/custom),
target_amount, current_amount, currency,
auto_scale (boolean), scale_factor (numeric), max_target (numeric),
current_tier (starter/growing/high-income/elite),
strategy (jsonb), preferred_niches (text[]),
status (active/paused/completed),
times_scaled (integer), created_at, updated_at, completed_at
```

**`goal_achievements` table:**
```sql
id, goal_id, achievement_type (target_hit/scaled/tier_upgrade/milestone),
amount_at_time, new_target, metadata (jsonb), created_at
```

**`users` table additions:**
```sql
ambition_level (normal/high/elite) -- default 'normal'
```

### API Usage

**1. Create Goal:**
```bash
POST /api/goals
{
  "userId": "uuid",
  "targetAmount": 1000,
  "goalType": "income",
  "options": {
    "autoScale": true,
    "scaleFactor": 2.0,
    "maxTarget": 50000
  }
}

Response:
{
  "status": "created",
  "goal": { ... },
  "message": "Goal created: $1000"
}
```

**2. Get Active Goal:**
```bash
GET /api/goals?userId=uuid&type=income

Response:
{
  "goal": { ... },
  "achievements": [ ... ],
  "progress": {
    "current": 500,
    "target": 1000,
    "percentage": 50
  }
}
```

**3. Update Goal Progress:**
```bash
PATCH /api/goals
{
  "goalId": "uuid",
  "amountToAdd": 100
}

Response:
{
  "status": "updated",
  "goal": { ... },
  "message": "Progress updated by $100"
}
```

**4. Get/Set Ambition Level:**
```bash
# Get
GET /api/goals/ambition?userId=uuid
Response: { "ambition": "normal", "levels": ["normal", "high", "elite"] }

# Set
POST /api/goals/ambition
{
  "userId": "uuid",
  "level": "elite"
}
```

**5. Get Strategy for Tier:**
```typescript
import { generateStrategyForTier } from "@/lib/autonomy/ambitionEngine";

const strategy = generateStrategyForTier("high-income", "elite");
// Returns: tier, niches, actions (with 1.5x multipliers), focus area
```

**6. Generate AI Mindset Prompt:**
```typescript
import { generateMindsetPrompt } from "@/lib/autonomy/ambitionEngine";

const prompt = generateMindsetPrompt("elite", "high", 50000);
// Returns: System prompt that guides AI behavior based on tier/ambition
```

### Autonomous Executor Integration

The executor now:
1. ✅ Checks access status before running
2. ✅ Gets user's current goal
3. ✅ Runs auto-apply jobs
4. ✅ Checks if goal needs scaling
5. ✅ Auto-scales goal if target met
6. ✅ Returns scaling result with new tier

**Usage in autonomous cycle:**
```typescript
import { runAutonomousCycle } from "@/lib/autonomy/executor";

const result = await runAutonomousCycle(userId);
// Returns:
// {
//   status: "executed" | "skipped" | "error",
//   applicationsCreated: number,
//   goalScaled?: boolean,
//   newTarget?: number
// }
```

### Conversation Engine Integration

The conversation engine now:
1. ✅ Checks access before responding
2. ✅ Loads user's ambition level
3. ✅ Loads current goal and tier
4. ✅ Generates tier+ambition-based mindset prompt
5. ✅ Includes goal progress in AI context
6. ✅ Stores ambition level in memory

**Example AI prompt now includes:**
```
You are operating in elite tier with high ambition mode.
Target: $50000
Progress: $35000/$50000
Goals are not limits—once achieved, scale and pursue higher-paying opportunities.
```

---

## Integration Checklist

### Phase 1: Runtime Safety ✅
- [x] Access guard checks in executor
- [x] Access check in conversation engine  
- [x] Graceful fallback if services unavailable

### Phase 2: User Experience ✅
- [x] Admin dashboard to manage access
- [x] Multi-channel notifications (email, WhatsApp, in-app)
- [x] Goals API for progress tracking
- [x] Ambition level control

### Phase 3: Autonomous Behavior ✅
- [x] Tier-based strategy generation
- [x] Ambition-driven multipliers
- [x] Auto-scaling on goal achievement
- [x] Mind-set prompts guide AI behavior

### Recommended integrations with existing systems:

1. **Voice Command Route** (`/api/voice`):
   - Already has access through conversation engine ✅

2. **Job Discovery** (`lib/jobs/autoApplyEngine.ts`):
   - Update to check ambition level and tier for filtering

3. **Earnings Tracking** (`/api/earnings`):
   - Update to trigger `updateGoalProgress()` on new earnings

4. **Worker Loops**:
   - Call `scaleGoalIfNeeded()` periodically

---

## Migration Instructions

### 1. Apply Migrations

```bash
cd c:\Users\kamog\Desktop\My Projects\va-beta

# Option A: Direct SQL
supabase db query < supabase/migrations/20260404_access_control_system.sql --linked
supabase db query < supabase/migrations/20260404_goals_and_ambition_system.sql --linked

# Option B: Full push (if possible)
supabase db push --linked
```

### 2. Environment Configuration

Update `.env.local` with:
```env
ADMIN_EMAIL=your-admin@gmail.com
NOTIFY_EMAIL=your-admin@gmail.com
NOTIFY_PASSWORD=your-app-password
```

### 3. Create Initial Admin User

```bash
# Insert admin user into database
supabase db query "
  INSERT INTO users (email, access_status, ambition_level)
  VALUES ('admin@company.com', 'approved', 'elite')
  ON CONFLICT DO NOTHING;
" --linked
```

### 4. Create Sample Goal

```bash
supabase db query "
  INSERT INTO goals (user_id, goal_type, target_amount, current_amount, current_tier, auto_scale)
  SELECT id, 'income', 1000, 0, 'starter', true
  FROM users WHERE email = 'user@example.com'
  ON CONFLICT DO NOTHING;
" --linked
```

---

## Testing

### Test Access Control Flow

```bash
# 1. Submit access request
curl -X POST http://localhost:3000/api/onboarding/request \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com",
    "name": "Test User",
    "reason": "Want to earn"
  }'

# 2. Check access status
curl "http://localhost:3000/api/onboarding/request?email=newuser@test.com"

# 3. Approve user
curl -X POST http://localhost:3000/api/admin/approve-user \
  -H "Content-Type: application/json" \
  -d '{ "email": "newuser@test.com" }'

# 4. Verify access granted
curl "http://localhost:3000/api/onboarding/request?email=newuser@test.com"
```

### Test Goals Scaling

```bash
# 1. Create goal
curl -X POST http://localhost:3000/api/goals \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "targetAmount": 1000,
    "goalType": "income"
  }'

# 2. Update progress to target
curl -X PATCH http://localhost:3000/api/goals \
  -H "Content-Type: application/json" \
  -d '{
    "goalId": "goal-uuid",
    "amountToAdd": 1000
  }'

# 3. Verify scaling
curl "http://localhost:3000/api/goals?userId=user-uuid"
# Should show: target_amount: 2000, times_scaled: 1
```

---

## Files Created

### Migrations
- `supabase/migrations/20260404_access_control_system.sql`
- `supabase/migrations/20260404_goals_and_ambition_system.sql`

### Libraries
- `lib/access/accessGuard.ts`
- `lib/notifications/adminAlert.ts`
- `lib/autonomy/scaleEngine.ts`
- `lib/autonomy/ambitionEngine.ts`

### API Routes
- `app/api/onboarding/request/route.ts`
- `app/api/admin/approve-user/route.ts`
- `app/api/admin/reject-user/route.ts`
- `app/api/admin/access-requests/route.ts`
- `app/api/goals/route.ts`
- `app/api/goals/ambition/route.ts`

### Admin UI
- `app/admin/access/page.tsx`

### Updated Files
- `lib/autonomy/executor.ts` (Added access check, goal scaling)
- `lib/voice/conversationEngine.ts` (Added access check, ambition engine)

---

## Next Steps (Optional Enhancements)

1. **Email Templates**: Create HTML email templates for approval/rejection
2. **SMS Alerts**: Add SMS notifications via Twilio SMS API
3. **Slack Integration**: Notify admin team on Slack when new requests arrive
4. **Goal Analytics**: Add dashboard showing goal progression trends
5. **Invite Codes**: Implement invite-only mode instead of open requests
6. **Auto-Escalation**: Automatically approve users after certain conditions
7. **Tier Badges**: Display tier badges on mobile/web UIs
8. **Strategy Customization**: Let users customize strategy per tier

---

## Troubleshooting

### Access Denied Error
- [ ] Check user `access_status` in database
- [ ] Verify migrations applied
- [ ] Check user ID format matches

### Scaling Not Triggering
- [ ] Verify `auto_scale = true` on goal
- [ ] Check `current_amount >= target_amount`
- [ ] Review goal_achievements table for records

### Notifications Not Sending
- [ ] Verify SMTP credentials in environment
- [ ] Check spam folder for emails
- [ ] Review error logs in database

### Goal Progress Not Updating
- [ ] Ensure `updateGoalProgress()` called after earnings
- [ ] Verify goal exists before updating
- [ ] Check for database transaction locks
