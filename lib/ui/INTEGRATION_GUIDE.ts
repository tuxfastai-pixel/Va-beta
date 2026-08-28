/**
 * INTEGRATION GUIDE: Notification Orchestrator
 *
 * This guide shows how to integrate the notification orchestrator
 * into existing systems for attention equilibrium.
 */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 1. ORCHESTRATOR INTEGRATION (lib/orchestrator/orchestrator.ts)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Example: Update runOrchestrator() to orchestrate notifications
 *
 * BEFORE:
 * ```
 * export async function runOrchestrator(user: OrchestratorUser) {
 *   const stateContext = buildUserSystemState(user);
 *   const state = getUserState(normalizedUser);
 *   // ... decision logic ...
 * }
 * ```
 *
 * AFTER:
 * ```
 * import { orchestrateNotification, SystemPressureState } from "@/lib/ui/notificationOrchestrator";
 *
 * export async function runOrchestrator(user: OrchestratorUser) {
 *   const stateContext = buildUserSystemState(user);
 *   const state = getUserState(normalizedUser);
 *
 *   // Map internal state to pressure state
 *   const pressureState = mapSystemStateToPressure(state);
 *
 *   // Store for this orchestrator cycle
 *   user.currentPressureState = pressureState;
 *
 *   // ... rest of orchestration ...
 * }
 *
 * function mapSystemStateToPressure(state: SystemState): SystemPressureState {
 *   // Example mapping from orchestrator state format to pressure state
 *   if (state.instability_rising) return "accelerated";
 *   if (state.recovery_active) return "recovery";
 *   if (state.identity_lock) return "locked";
 *   if (state.stabilization_in_progress) return "stabilizing";
 *   return "balanced";
 * }
 * ```
 */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 2. ACCOUNT MANAGER INTEGRATION (lib/clients/accountManager.ts)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Example: Update sendMessageToClient() to use orchestrator
 *
 * BEFORE:
 * ```
 * async function sendMessageToClient(
 *   client: ClientRow,
 *   type: string,
 *   title: string,
 *   message: string,
 *   priority: "low" | "normal" | "high" = "normal"
 * ): Promise<boolean> {
 *   await createClientNotification(client, type, title, message, priority);
 *
 *   if (!client.email) {
 *     console.warn(`...`);
 *     return true;
 *   }
 *
 *   try {
 *     await sendNotification(client.email, title, message);
 *   } catch (err) {
 *     console.error(`...`);
 *   }
 *
 *   return true;
 * }
 * ```
 *
 * AFTER:
 * ```
 * import { orchestrateNotification } from "@/lib/ui/notificationOrchestrator";
 * import { getUserState } from "@/lib/orchestrator/stateManager";
 *
 * async function sendMessageToClient(
 *   client: ClientRow,
 *   type: string,
 *   title: string,
 *   message: string,
 *   priority: "low" | "normal" | "high" = "normal",
 *   currentPressureState?: SystemPressureState
 * ): Promise<boolean> {
 *   // Get user's current pressure state if not provided
 *   const pressureState = currentPressureState || await getUserPressureState(client.id);
 *
 *   // Orchestrate the notification
 *   const { decision, transformedNotification, scheduled } = await orchestrateNotification(
 *     {
 *       userId: client.id,
 *       type,
 *       priority: priority === "high" ? "high" : priority === "low" ? "low" : "normal",
 *       title,
 *       message,
 *       metadata: {
 *         source: "account_manager",
 *         score: client.score,
 *         tier: client.score_tier,
 *       },
 *     },
 *     pressureState
 *   );
 *
 *   console.log(`[Notification] ${type} - Decision: ${decision.action}`);
 *
 *   // Only send email if not suppressed
 *   if (decision.action !== "suppress" && client.email) {
 *     try {
 *       await sendNotification(
 *         client.email,
 *         transformedNotification.title,
 *         transformedNotification.message
 *       );
 *     } catch (err) {
 *       console.error(`Failed to send message to ${client.email}:`, err);
 *     }
 *   }
 *
 *   return scheduled;
 * }
 *
 * async function getUserPressureState(userId: string): Promise<SystemPressureState> {
 *   const { data: profile } = await supabaseServer
 *     .from("profiles")
 *     .select("system_state")
 *     .eq("id", userId)
 *     .maybeSingle();
 *
 *   // Map profile state to pressure state
 *   return mapSystemStateToPressure(profile?.system_state || {});
 * }
 * ```
 */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 3. WORKER INTEGRATION (workers/aiWorker.ts)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Example: Update createClientInvoiceAndNotification() to use orchestrator
 *
 * BEFORE:
 * ```
 * async function createClientInvoiceAndNotification(task: WorkerTask) {
 *   // ... invoice creation ...
 *
 *   await supabase.from("client_notifications").insert({
 *     client_id: clientId,
 *     task_id: task.id,
 *     notification_type: notificationType,
 *     priority: isHighValue ? "high" : "normal",
 *     title: isHighValue ? "High-value task completed" : "Task completed",
 *     message: "...",
 *     payload: { ... },
 *   });
 * }
 * ```
 *
 * AFTER:
 * ```
 * import { orchestrateNotification } from "@/lib/ui/notificationOrchestrator";
 *
 * async function createClientInvoiceAndNotification(task: WorkerTask) {
 *   // ... invoice creation ...
 *
 *   // Get client's pressure state
 *   const pressureState = await getClientPressureState(clientId);
 *
 *   // Orchestrate the notification
 *   await orchestrateNotification(
 *     {
 *       userId: clientId,
 *       type: notificationType,
 *       priority: isHighValue ? "high" : "normal",
 *       title: isHighValue ? "High-value task completed" : "Task completed",
 *       message: `Task ${task.id} completed. Invoice generated...`,
 *       metadata: {
 *         amount: fee.amount,
 *         currency: fee.currency,
 *         task_type: taskType,
 *         source: "worker",
 *       },
 *     },
 *     pressureState
 *   );
 * }
 * ```
 */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4. BATCH DIGEST DELIVERY (lib/tasks/notificationBatcher.ts - NEW)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Example: Create a scheduled task to send batch digests
 *
 * NEW FILE: lib/tasks/notificationBatcher.ts
 * ```
 * import { supabaseServer } from "@/lib/supabaseServer";
 * import {
 *   compileBatchDigest,
 *   getToneConfigForState,
 *   transformUrgencyWording,
 * } from "@/lib/ui/notificationOrchestrator";
 *
 * export async function sendScheduledDigests() {
 *   // Get all users with notifications scheduled for digest
 *   const { data: pendingUsers } = await supabaseServer
 *     .from("client_notifications")
 *     .select("user_id, payload")
 *     .eq("is_read", false)
 *     .contains("payload", { orchestrationDecision: "digest" })
 *     .limit(100);
 *
 *   if (!pendingUsers) return;
 *
 *   const userIds = [...new Set(pendingUsers.map((n) => n.user_id))];
 *
 *   for (const userId of userIds) {
 *     const digest = await compileBatchDigest(userId, 24); // Last 24 hours
 *
 *     if (digest.count === 0) continue;
 *
 *     // Get user's pressure state and tone
 *     const pressureState = await getClientPressureState(userId);
 *     const toneConfig = getToneConfigForState(pressureState);
 *
 *     const { title, message } = transformUrgencyWording(
 *       "Daily Notification Summary",
 *       digest.summary,
 *       toneConfig.urgencyStyle
 *     );
 *
 *     // Send digest email
 *     await sendNotification(
 *       await getUserEmail(userId),
 *       title,
 *       message
 *     );
 *
 *     // Mark as delivered
 *     await supabaseServer
 *       .from("client_notifications")
 *       .update({ is_read: true })
 *       .eq("user_id", userId)
 *       .eq("is_read", false)
 *       .lte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
 *   }
 * }
 *
 * // Call from scheduler or API
 * // Schedule: every 24 hours (for digest mode), or every 2 hours (for grouped mode)
 * ```
 */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 5. CLIENT PORTAL UI (app/client-portal/notifications/page.tsx - NEW)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Example: Render notifications respecting orchestration
 *
 * NEW FILE: app/client-portal/notifications/page.tsx
 * ```
 * "use client";
 *
 * import { useEffect, useState } from "react";
 * import { supabase } from "@/lib/supabase";
 *
 * export default function NotificationsPage() {
 *   const [notifications, setNotifications] = useState<any[]>([]);
 *   const [digestMode, setDigestMode] = useState(false);
 *
 *   useEffect(() => {
 *     const loadNotifications = async () => {
 *       const { data } = await supabase
 *         .from("client_notifications")
 *         .select("*")
 *         .eq("is_read", false)
 *         .order("created_at", { ascending: false })
 *         .limit(20);
 *
 *       if (data) {
 *         // Check if orchestration decision is "digest"
 *         const isDigestMode = data.some(
 *           (n) => n.payload?.orchestrationDecision === "digest"
 *         );
 *         setDigestMode(isDigestMode);
 *         setNotifications(data);
 *       }
 *     };
 *
 *     loadNotifications();
 *   }, []);
 *
 *   if (digestMode) {
 *     return (
 *       <div className="p-4">
 *         <h1>ðŸ“‹ Daily Summary</h1>
 *         <p>You're in focused mode. Notifications are batched for review.</p>
 *         {"Digest view placeholder"}
 *       </div>
 *     );
 *   }
 *
 *   return (
 *     <div className="p-4">
 *       <h1>ðŸ”” Notifications</h1>
 *       {"Notification list placeholder"}
 *     </div>
 *   );
 * }
 * ```
 */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 6. KEY INTEGRATION POINTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Summary of where to integrate:
 *
 * 1. âœ… lib/ui/notificationOrchestrator.ts
 *    - Main module (already created)
 *
 * 2. ðŸ“ lib/orchestrator/orchestrator.ts
 *    - Add pressureState to OrchestratorUser type
 *    - Call mapSystemStateToPressure() in runOrchestrator()
 *    - Pass pressureState to orchestrateNotification() calls
 *
 * 3. ðŸ“ lib/clients/accountManager.ts
 *    - Update sendMessageToClient() signature
 *    - Call orchestrateNotification()
 *    - Check decision.action before email send
 *
 * 4. ðŸ“ workers/aiWorker.ts
 *    - Update createClientInvoiceAndNotification()
 *    - Call orchestrateNotification()
 *
 * 5. âœ¨ lib/tasks/notificationBatcher.ts (NEW)
 *    - Scheduled task to send batch digests
 *    - Call compileBatchDigest()
 *    - Send summary emails per pressure state
 *
 * 6. âœ¨ app/client-portal/notifications/page.tsx (NEW)
 *    - Render notifications respecting orchestration decisions
 *    - Show digest view for recovery/locked states
 *    - Respect interruption tolerance
 *
 * 7. ðŸ“ lib/notifications/* (email.ts, adminAlert.ts, etc.)
 *    - Optional: Wrap existing sends with orchestrateNotification()
 *    - Use for graceful degradation
 */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 7. TESTING THE ORCHESTRATOR
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Example: Test harness for notification orchestration
 *
 * ```
 * import { orchestrateNotification, getToneConfigForState } from "@/lib/ui/notificationOrchestrator";
 *
 * async function testOrchestrator() {
 *   const testUserId = "test-user-123";
 *
 *   // Test each pressure state
 *   const states: SystemPressureState[] = [
 *     "accelerated",
 *     "balanced",
 *     "stabilizing",
 *     "recovery",
 *     "locked",
 *   ];
 *
 *   for (const state of states) {
 *     console.log(`\\n=== Testing ${state} state ===`);
 *     const config = getToneConfigForState(state);
 *     console.log("Tone config:", config);
 *
 *     const { decision, transformedNotification } = await orchestrateNotification(
 *       {
 *         userId: testUserId,
 *         type: "test_notification",
 *         priority: "normal",
 *         title: "Test: High-match job found",
 *         message: "Check out this new opportunity.",
 *       },
 *       state
 *     );
 *
 *     console.log("Delivery decision:", decision.action);
 *     console.log("Transformed title:", transformedNotification.title);
 *   }
 * }
 * ```
 */

export {};
