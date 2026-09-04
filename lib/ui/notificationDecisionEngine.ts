export type NotificationPriority = "critical" | "high" | "normal" | "low";

export type SystemPressureState =
  | "accelerated"
  | "balanced"
  | "stabilizing"
  | "recovery"
  | "locked";

export type BatchingStrategy = "immediate" | "grouped" | "digest" | "suppressed";

export interface NotificationToneConfig {
  batchingStrategy: BatchingStrategy;
  simultaneousLimit: number;
  digestInterval: number;
}

export interface DeliveryDecision {
  action: "deliver_now" | "batch" | "digest" | "suppress";
  timing?: Date;
  groupId?: string;
  reasoning: string;
}

export interface DeliveryNotificationInput {
  type: string;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
}

export interface DeliveryDecisionInput {
  notification: DeliveryNotificationInput;
  pressureState: SystemPressureState;
  toneConfig: NotificationToneConfig;
  userFatigue: number;
  recentCount: number;
  now?: Date;
}

function isContinuityCritical(notification: DeliveryNotificationInput): boolean {
  if (notification.priority === "critical") {
    return true;
  }

  if (notification.type === "identity_lock" || notification.type === "critical_continuity") {
    return true;
  }

  return notification.metadata?.continuityCritical === true;
}

export function decideDeliveryAction(input: DeliveryDecisionInput): DeliveryDecision {
  const now = input.now ?? new Date();
  const { notification, toneConfig, pressureState, userFatigue, recentCount } = input;

  // Critical continuity events always bypass suppression/batching.
  if (isContinuityCritical(notification)) {
    return {
      action: "deliver_now",
      timing: now,
      reasoning: `Critical continuity event (${notification.type}) bypasses suppression and batching.`,
    };
  }

  // Balanced mode can still deliver now for high urgency if the user is not fatigued.
  if (
    pressureState === "balanced" &&
    notification.priority === "high" &&
    userFatigue <= 0.35 &&
    recentCount === 0
  ) {
    return {
      action: "deliver_now",
      timing: now,
      reasoning: "Balanced state with high urgency and low fatigue; deliver immediately.",
    };
  }

  if (toneConfig.batchingStrategy === "immediate") {
    if (userFatigue > 0.75 && notification.priority === "low") {
      return {
        action: "digest",
        timing: new Date(now.getTime() + toneConfig.digestInterval * 60 * 1000),
        reasoning: "High fatigue with low-priority item; defer to digest.",
      };
    }

    if (recentCount >= toneConfig.simultaneousLimit) {
      return {
        action: "batch",
        timing: new Date(now.getTime() + 5 * 60 * 1000),
        reasoning: "Simultaneous limit reached; batch with nearby notifications.",
      };
    }

    return {
      action: "deliver_now",
      timing: now,
      reasoning: "Immediate strategy with acceptable fatigue and queue load.",
    };
  }

  if (toneConfig.batchingStrategy === "grouped") {
    return {
      action: "batch",
      timing: new Date(now.getTime() + 3 * 60 * 1000),
      reasoning: "Grouped strategy active; batching notifications.",
    };
  }

  if (toneConfig.batchingStrategy === "digest") {
    return {
      action: "digest",
      timing: new Date(now.getTime() + toneConfig.digestInterval * 60 * 1000),
      reasoning: "Digest strategy active; queue for digest delivery.",
    };
  }

  return {
    action: "suppress",
    reasoning: "Suppressed strategy active for non-critical notification.",
  };
}
