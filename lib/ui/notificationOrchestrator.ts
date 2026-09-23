/**
 * Notification Orchestrator
 *
 * Equilibrium-aware attention governance system.
 * Regulates notification delivery, density, urgency, and interruption
 * based on system pressure state and user cognitive load.
 *
 * Transforms raw notifications into adaptive, contextual delivery
 * that preserves user agency and prevents notification fatigue.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import {
  decideDeliveryAction,
  type DeliveryDecision as EngineDeliveryDecision,
  type NotificationToneConfig as EngineNotificationToneConfig,
} from "@/lib/ui/notificationDecisionEngine";
import { predictFatigue, type FatigueInputs, type FatiguePrediction } from "@/lib/ui/predictiveFatigueModel";

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export type SystemPressureState =
  | "accelerated"
  | "balanced"
  | "stabilizing"
  | "recovery"
  | "locked";

export type NotificationDensity = "high" | "normal" | "low" | "minimal";
export type UrgencyStyle = "critical" | "proactive" | "informative" | "quiet" | "essential";
export type BatchingStrategy = "immediate" | "grouped" | "digest" | "suppressed";

export interface NotificationToneConfig {
  notificationDensity: NotificationDensity;
  urgencyStyle: UrgencyStyle;
  batchingStrategy: BatchingStrategy;
  interruptionTolerance: number; // 0-1 (higher = more interruptions allowed)
  repeatReminderThreshold: number; // hours before repeating a reminder
  simultaneousLimit: number; // max notifications shown at once
  digestInterval: number; // minutes
}

export interface NotificationPayload {
  userId: string;
  type: string; // "job_match", "task_complete", "payment", "suggestion", etc.
  priority: "critical" | "high" | "normal" | "low";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  shouldInterrupt?: boolean; // intent
  retryCount?: number;
}

export interface PendingNotification extends NotificationPayload {
  id: string;
  createdAt: Date;
  scheduledFor?: Date;
  batchedWith?: string[];
  attempts: number;
}

export interface DeliveryDecision {
  action: "deliver_now" | "batch" | "digest" | "suppress";
  timing?: Date;
  groupId?: string;
  reasoning: string;
}

export interface UserCognitiveLoad {
  recentInteractionCount: number; // last hour
  averageResponseTime: number; // ms
  abandonmentRate: number; // 0-1
  lastActivityTime: Date;
  fatigueScore: number; // 0-1 (0 = fresh, 1 = exhausted)
  ignoreRate: number; // notifications ignored / total
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function buildFatigueInputs(pressureState: SystemPressureState, userFatigue: number, recentCount: number): FatigueInputs {
  const normalizedRecentCount = clamp01(recentCount / 8);
  const normalizedPressure = pressureState === "accelerated" ? 0.2 : pressureState === "balanced" ? 0.35 : pressureState === "stabilizing" ? 0.55 : pressureState === "recovery" ? 0.8 : 0.95;

  return {
    ignoredNotificationRate: clamp01(userFatigue * 0.7 + normalizedRecentCount * 0.3),
    actionDelayTrend: clamp01(userFatigue * 0.65 + normalizedPressure * 0.35),
    refinementLoopCount: Math.min(12, Math.round(recentCount * 1.5 + userFatigue * 6)),
    sessionVolatility: clamp01(userFatigue * 0.6 + normalizedRecentCount * 0.4),
    interruptionSensitivity: clamp01(userFatigue),
    recoveryFrequency: clamp01(normalizedPressure + (pressureState === "recovery" || pressureState === "locked" ? 0.2 : 0)),
  };
}

function downshiftPressureState(
  pressureState: SystemPressureState,
  prediction: FatiguePrediction
): SystemPressureState {
  if (!prediction.proactiveDownshiftRequired) {
    return pressureState;
  }

  if (prediction.recommendedInteractionMode === "recovery") {
    if (pressureState === "accelerated") return "stabilizing";
    if (pressureState === "balanced") return "recovery";
    return pressureState === "locked" ? "locked" : "recovery";
  }

  if (prediction.recommendedInteractionMode === "quiet") {
    if (pressureState === "accelerated") return "balanced";
    if (pressureState === "balanced") return "stabilizing";
    return pressureState === "recovery" || pressureState === "locked" ? pressureState : "stabilizing";
  }

  if (prediction.recommendedInteractionMode === "reduced") {
    if (pressureState === "accelerated") return "balanced";
    if (pressureState === "balanced") return "stabilizing";
    if (pressureState === "stabilizing") return "recovery";
    return pressureState;
  }

  return pressureState;
}

function applyPredictiveDownshift(
  pressureState: SystemPressureState,
  userFatigue: number,
  recentCount: number
): { effectivePressureState: SystemPressureState; prediction: FatiguePrediction } {
  const prediction = predictFatigue(buildFatigueInputs(pressureState, userFatigue, recentCount));
  const effectivePressureState = downshiftPressureState(pressureState, prediction);

  return { effectivePressureState, prediction };
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM STATE → NOTIFICATION TONE MAPPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps system pressure state to notification governance parameters.
 * This is the core equilibrium translation logic.
 */
export function getToneConfigForState(
  pressureState: SystemPressureState,
  userFatigue: number = 0
): NotificationToneConfig {
  const configs: Record<SystemPressureState, NotificationToneConfig> = {
    accelerated: {
      notificationDensity: userFatigue > 0.6 ? "low" : "normal",
      urgencyStyle: "proactive",
      batchingStrategy: "immediate",
      interruptionTolerance: userFatigue > 0.6 ? 0.3 : 0.65,
      repeatReminderThreshold: 2,
      simultaneousLimit: 3,
      digestInterval: 15,
    },

    balanced: {
      notificationDensity: "normal",
      urgencyStyle: "informative",
      batchingStrategy: "grouped",
      interruptionTolerance: 0.45,
      repeatReminderThreshold: 4,
      simultaneousLimit: 2,
      digestInterval: 30,
    },

    stabilizing: {
      notificationDensity: "low",
      urgencyStyle: "quiet",
      batchingStrategy: "grouped",
      interruptionTolerance: userFatigue > 0.7 ? 0.15 : 0.3,
      repeatReminderThreshold: 6,
      simultaneousLimit: 1,
      digestInterval: 60,
    },

    recovery: {
      notificationDensity: "minimal",
      urgencyStyle: "essential",
      batchingStrategy: "digest",
      interruptionTolerance: 0.08,
      repeatReminderThreshold: 12,
      simultaneousLimit: 0, // No interruptions
      digestInterval: 120,
    },

    locked: {
      notificationDensity: "minimal",
      urgencyStyle: "essential",
      batchingStrategy: "suppressed",
      interruptionTolerance: 0.02, // Emergency only
      repeatReminderThreshold: 24,
      simultaneousLimit: 0,
      digestInterval: 240,
    },
  };

  return configs[pressureState];
}

// ─────────────────────────────────────────────────────────────────────────────
// COGNITIVE LOAD DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect user fatigue from interaction patterns.
 * Higher score = more exhausted, less tolerant of interruptions.
 */
export async function detectUserFatigue(userId: string): Promise<number> {
  try {
    // Get recent interactions
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: interactions, error: intError } = await supabaseServer
      .from("ai_memory")
      .select("created_at, context")
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo)
      .limit(50);

    if (intError || !interactions) {
      return 0.3; // Default moderate fatigue
    }

    const recentCount = interactions.length;

    // Get ignored notifications
    const { data: ignored, error: ignError } = await supabaseServer
      .from("client_notifications")
      .select("id")
      .eq("client_id", userId)
      .eq("is_read", false)
      .gte("created_at", oneHourAgo);

    if (ignError) {
      return 0.3;
    }

    const ignoreCount = ignored?.length || 0;

    // Simple fatigue score:
    // - Many interactions = higher fatigue
    // - Many ignored notifications = higher fatigue
    // - Combine with time decay (older interactions = less fatigue)
    const interactionFatigue = Math.min(1, recentCount / 20);
    const ignoreFatigue = ignoreCount > 0 ? Math.min(1, ignoreCount / 5) : 0;

    const fatigueScore = (interactionFatigue * 0.6 + ignoreFatigue * 0.4) * 1.1; // Slight bias toward caution

    return Math.min(1, fatigueScore);
  } catch (err) {
    console.error("[Notification Orchestrator] Fatigue detection error:", err);
    return 0.4; // Conservative default
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY DECISION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decide how to deliver a notification based on:
 * - System pressure state
 * - User cognitive load
 * - Notification priority
 * - Recent delivery history
 */
export async function decideDelivery(
  notification: NotificationPayload,
  pressureState: SystemPressureState
): Promise<DeliveryDecision> {
  const userFatigue = await detectUserFatigue(notification.userId);

  // Check recent delivery frequency for this user
  const { data: recentNotifs } = await supabaseServer
    .from("client_notifications")
    .select("id, created_at")
    .eq("client_id", notification.userId)
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
    .limit(10);

  const recentCount = recentNotifs?.length || 0;
  const { effectivePressureState, prediction } = applyPredictiveDownshift(pressureState, userFatigue, recentCount);
  const toneConfig = getToneConfigForState(effectivePressureState, userFatigue);

  const engineDecision: EngineDeliveryDecision = decideDeliveryAction({
    notification: {
      type: notification.type,
      priority: notification.priority,
      metadata: notification.metadata,
    },
    pressureState: effectivePressureState,
    toneConfig: {
      batchingStrategy: toneConfig.batchingStrategy,
      simultaneousLimit: toneConfig.simultaneousLimit,
      digestInterval: toneConfig.digestInterval,
    } as EngineNotificationToneConfig,
    userFatigue,
    recentCount,
  });

  if (prediction.proactiveDownshiftRequired && engineDecision.action === "deliver_now" && notification.priority !== "critical") {
    return {
      ...engineDecision,
      action: effectivePressureState === "recovery" || effectivePressureState === "locked" ? "digest" : "batch",
      reasoning: `${engineDecision.reasoning} Predictive fatigue downshift applied (${prediction.recommendedInteractionMode} mode).`,
    };
  }

  return {
    ...engineDecision,
    reasoning: prediction.proactiveDownshiftRequired
      ? `${engineDecision.reasoning} Predictive fatigue downshift applied (${prediction.recommendedInteractionMode} mode).`
      : engineDecision.reasoning,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// URGENCY WORDING TRANSFORMATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translate notification content based on urgency style.
 * Same event, different framing based on user state.
 */
export function transformUrgencyWording(
  title: string,
  message: string,
  urgencyStyle: UrgencyStyle
): { title: string; message: string } {
  const normalizeTitle = title.trim();
  const normalizeMessage = message.trim();

  switch (urgencyStyle) {
    case "critical":
      return {
        title: `🚨 ${normalizeTitle}`,
        message: `${normalizeMessage}\n\nImmediate action required.`,
      };

    case "proactive":
      return {
        title: `→ ${normalizeTitle}`,
        message: `${normalizeMessage}\n\nI found this and thought you should know.`,
      };

    case "informative":
      return {
        title: normalizeTitle,
        message: normalizeMessage,
      };

    case "quiet":
      return {
        title: normalizeTitle,
        message: normalizeMessage, // No added pressure
      };

    case "essential":
      return {
        title: normalizeTitle,
        message: `${normalizeMessage}\n\nPlease review when convenient.`,
      };

    default:
      return { title: normalizeTitle, message: normalizeMessage };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPEAT REMINDER GOVERNANCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a notification reminder should be resent
 * based on user interaction patterns and system state.
 */
export async function shouldRepeatReminder(
  userId: string,
  notificationType: string,
  lastSentAt: Date,
  toneConfig: NotificationToneConfig
): Promise<boolean> {
  // Has enough time passed?
  const hoursSince = (Date.now() - lastSentAt.getTime()) / (60 * 60 * 1000);
  if (hoursSince < toneConfig.repeatReminderThreshold) {
    return false;
  }

  // Did user interact with the original notification?
  const { data: interactions } = await supabaseServer
    .from("client_notifications")
    .select("id")
    .eq("client_id", userId)
    .eq("notification_type", notificationType)
    .eq("is_read", true)
    .gte("created_at", lastSentAt.toISOString())
    .limit(1);

  // If interacted, don't repeat
  if (interactions && interactions.length > 0) {
    return false;
  }

  // If ignored for too long, repeat once as reminder
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATION: COMPLETE FLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete notification orchestration flow:
 * 1. Detect system pressure
 * 2. Get user fatigue
 * 3. Decide delivery method
 * 4. Transform urgency
 * 5. Execute delivery
 */
export async function orchestrateNotification(
  notification: NotificationPayload,
  pressureState: SystemPressureState
): Promise<{
  decision: DeliveryDecision;
  transformedNotification: NotificationPayload;
  scheduled: boolean;
}> {
  try {
    // Detect delivery decision
    const decision = await decideDelivery(notification, pressureState);

    // Get tone config for this state
    const userFatigue = await detectUserFatigue(notification.userId);
    const toneConfig = getToneConfigForState(pressureState, userFatigue);

    // Transform urgency wording
    const { title, message } = transformUrgencyWording(
      notification.title,
      notification.message,
      toneConfig.urgencyStyle
    );

    const transformedNotification: NotificationPayload = {
      ...notification,
      title,
      message,
    };

    // Store in database based on decision
    if (decision.action === "deliver_now") {
      await supabaseServer.from("client_notifications").insert({
        client_id: notification.userId, // Use userId as client_id if not provided
        notification_type: notification.type,
        priority: notification.priority,
        title,
        message,
        payload: {
          ...notification.metadata,
          orchestrationDecision: "immediate",
          userFatigue: (userFatigue * 100).toFixed(0) + "%",
        },
        is_read: false,
      });

      return {
        decision,
        transformedNotification,
        scheduled: true,
      };
    }

    if (decision.action === "suppress") {
      // Log suppressed notification but don't store
      console.log(
        `[Notification Orchestrator] Suppressed ${notification.type} for user ${notification.userId} (state: ${pressureState})`
      );

      return {
        decision,
        transformedNotification,
        scheduled: false,
      };
    }

    // For batch/digest: store with scheduled time
    const scheduledFor = decision.timing || new Date(Date.now() + 30 * 60 * 1000);

    await supabaseServer.from("client_notifications").insert({
      client_id: notification.userId,
      notification_type: notification.type,
      priority: notification.priority,
      title,
      message,
      payload: {
        ...notification.metadata,
        orchestrationDecision: decision.action,
        scheduledFor: scheduledFor.toISOString(),
        userFatigue: (userFatigue * 100).toFixed(0) + "%",
      },
      is_read: false,
    });

    return {
      decision,
      transformedNotification,
      scheduled: true,
    };
  } catch (err) {
    console.error("[Notification Orchestrator] Orchestration error:", err);

    // Fail open: deliver immediately if orchestration fails
    return {
      decision: {
        action: "deliver_now",
        timing: new Date(),
        reasoning: "Orchestration failed; delivered immediately for safety.",
      },
      transformedNotification: notification,
      scheduled: true,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH/DIGEST COMPILATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compile pending notifications into a digest summary.
 * Used for batched/digest delivery modes.
 */
export async function compileBatchDigest(
  userId: string,
  hoursBack: number = 1
): Promise<{
  count: number;
  summary: string;
  byType: Record<string, number>;
}> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const { data: pending } = await supabaseServer
    .from("client_notifications")
    .select("notification_type, title, priority")
    .eq("client_id", userId)
    .eq("is_read", false)
    .gte("created_at", cutoff)
    .limit(100);

  if (!pending || pending.length === 0) {
    return {
      count: 0,
      summary: "No pending notifications.",
      byType: {},
    };
  }

  const byType: Record<string, number> = {};
  for (const notif of pending) {
    const type = String(notif.notification_type || "other");
    byType[type] = (byType[type] || 0) + 1;
  }

  const typeList = Object.entries(byType)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");

  return {
    count: pending.length,
    summary: `You have ${pending.length} pending notification${pending.length !== 1 ? "s" : ""}: ${typeList}.`,
    byType,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public API for notification orchestration:
 *
 * 1. orchestrateNotification() - Main entry point
 * 2. getToneConfigForState() - Get delivery parameters for a state
 * 3. detectUserFatigue() - Assess user cognitive load
 * 4. decideDelivery() - Get delivery decision for a notification
 * 5. transformUrgencyWording() - Adapt message tone
 * 6. compileBatchDigest() - Create digest summaries
 */
