import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

interface OperationalMetrics {
  urgentJobs: number;
  priorityLeads: number;
  newInterviews: number;
  pendingPayments: number;
  tenderDeadlines: number;
  slaBreaches: number;
  highConfidenceApps: number;
  dailyRevenue: number;
}

interface UrgentItem {
  id: string;
  type: "job" | "lead" | "interview" | "payment" | "tender" | "sla";
  title: string;
  description: string;
  priority: "critical" | "high" | "medium";
  dueAt?: string;
  actionUrl?: string;
}

interface ApprovalItem {
  id: string;
  type: "auto_apply" | "tender" | "contract" | "negotiation" | "resume_variant" | "pricing";
  title: string;
  description: string;
  expiresAt: string;
  requiresApproval: boolean;
}

export default function OperationsCenterScreen() {
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);
  const [urgentItems, setUrgentItems] = useState<UrgentItem[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);


  const loadOperationsData = useCallback(async () => {
    try {
      // In a real app, get the actual user ID and token
      const userId = "user-123"; // Replace with actual user ID
      const token = "Bearer token-xxx"; // Replace with actual token

      const response = await fetch(
        `https://your-domain.com/api/mobile/operations?userId=${userId}`,
        {
          headers: {
            Authorization: token,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to load operations data");

      const data = await response.json();
      setMetrics(data.metrics);
      setUrgentItems(data.urgentItems || []);
      setApprovalQueue(data.approvalQueue || []);
      setCurrentTimestamp(Date.now());
    } catch (error) {
      console.error("Error loading operations:", error);
      Alert.alert("Error", "Failed to load operations dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(loadOperationsData, 0);
    // Set up polling every 30 seconds
    const interval = setInterval(loadOperationsData, 30000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadOperationsData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOperationsData();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "#FF3B30";
      case "high":
        return "#FF9500";
      case "medium":
        return "#FFCC00";
      default:
        return "#34C759";
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "job":
        return "briefcase";
      case "lead":
        return "user-tie";
      case "interview":
        return "comments";
      case "payment":
        return "credit-card";
      case "tender":
        return "file-contract";
      case "sla":
        return "exclamation-triangle";
      default:
        return "bell";
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading operations center...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Operations Center</Text>
        <Text style={styles.headerSubtitle}>Business Control Dashboard</Text>
      </View>

      {/* Key Metrics Grid */}
      {metrics && (
        <View style={styles.metricsContainer}>
          <View style={styles.metricsRow}>
            <MetricCard
              icon="briefcase"
              label="Urgent Jobs"
              value={metrics.urgentJobs}
              color="#007AFF"
            />
            <MetricCard
              icon="users"
              label="Priority Leads"
              value={metrics.priorityLeads}
              color="#34C759"
            />
          </View>

          <View style={styles.metricsRow}>
            <MetricCard
              icon="microphone"
              label="New Interviews"
              value={metrics.newInterviews}
              color="#FF9500"
            />
            <MetricCard
              icon="dollar-sign"
              label="Pending Payments"
              value={metrics.pendingPayments}
              color="#5856D6"
            />
          </View>

          <View style={styles.metricsRow}>
            <MetricCard
              icon="file-contract"
              label="Tender Deadlines"
              value={metrics.tenderDeadlines}
              color="#FF3B30"
            />
            <MetricCard
              icon="bell"
              label="SLA Breaches"
              value={metrics.slaBreaches}
              color="#FF3B30"
              highlight={metrics.slaBreaches > 0}
            />
          </View>

          <View style={styles.metricsRow}>
            <MetricCard
              icon="check-circle"
              label="High-Confidence Apps"
              value={metrics.highConfidenceApps}
              color="#34C759"
            />
            <MetricCard
              icon="chart-line"
              label="Daily Revenue"
              value={`$${metrics.dailyRevenue.toLocaleString()}`}
              color="#007AFF"
            />
          </View>
        </View>
      )}

      {/* Urgent Items Section */}
      {urgentItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ðŸ”´ Urgent Items ({urgentItems.length})</Text>
          {urgentItems.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.itemCard,
                {
                  borderLeftColor: getPriorityColor(item.priority),
                  backgroundColor:
                    item.priority === "critical"
                      ? "#FFE5E5"
                      : item.priority === "high"
                      ? "#FFF4E5"
                      : "#FFFAE5",
                },
              ]}
            >
              <View style={styles.itemHeader}>
                <FontAwesome5 name={getItemIcon(item.type)} size={16} color={getPriorityColor(item.priority)} />
                <View style={styles.itemTitleContainer}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                </View>
              </View>
              {item.dueAt && (
                <Text style={styles.itemDue}>
                  Due: {new Date(item.dueAt).toLocaleDateString()} {new Date(item.dueAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )}
              <TouchableOpacity style={styles.itemAction}>
                <Text style={styles.itemActionText}>Take Action â†’</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Approval Queue Section */}
      {approvalQueue.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>â³ Approvals Pending ({approvalQueue.length})</Text>
          {approvalQueue.map(item => (
            <View key={item.id} style={styles.approvalCard}>
              <View style={styles.approvalHeader}>
                <Text style={styles.approvalType}>{item.type.replace(/_/g, " ").toUpperCase()}</Text>
                <Text
                  style={[
                    styles.approvalExpires,
                    {
                      color:
                        new Date(item.expiresAt).getTime() - currentTimestamp < 3600000
                          ? "#FF3B30"
                          : "#FF9500",
                    },
                  ]}
                >
                  Expires in{" "}
                  {Math.round(
                    (new Date(item.expiresAt).getTime() - currentTimestamp) / 60000
                  )}m
                </Text>
              </View>
              <Text style={styles.approvalTitle}>{item.title}</Text>
              <Text style={styles.approvalDescription}>{item.description}</Text>
              <View style={styles.approvalActions}>
                <TouchableOpacity style={styles.approveButton}>
                  <Text style={styles.approveButtonText}>âœ“ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectButton}>
                  <Text style={styles.rejectButtonText}>âœ• Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <QuickActionButton
            icon="play"
            label="Start Auto-Apply"
            onPress={() => Alert.alert("Auto-Apply", "Starting auto-apply process...")}
          />
          <QuickActionButton
            icon="microphone"
            label="Live Interview Mode"
            onPress={() => Alert.alert("Live Mode", "Preparing interview assistant...")}
          />
          <QuickActionButton
            icon="handshake"
            label="Show Pending Approvals"
            onPress={() => Alert.alert("Approvals", "Loading approval queue...")}
          />
          <QuickActionButton
            icon="chart-bar"
            label="View Analytics"
            onPress={() => Alert.alert("Analytics", "Opening analytics dashboard...")}
          />
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Last updated: {new Date().toLocaleTimeString()}</Text>
        <Text style={styles.footerHint}>Pull to refresh</Text>
      </View>
    </ScrollView>
  );
}

interface MetricCardProps {
  icon: string;
  label: string;
  value: string | number;
  color: string;
  highlight?: boolean;
}

function MetricCard({ icon, label, value, color, highlight }: MetricCardProps) {
  return (
    <View style={[styles.metricCard, highlight && styles.metricCardHighlight]}>
      <FontAwesome5 name={icon} size={24} color={color} style={styles.metricIcon} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

interface QuickActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
}

function QuickActionButton({ icon, label, onPress }: QuickActionButtonProps) {
  return (
    <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
      <FontAwesome5 name={icon} size={20} color="#007AFF" style={styles.quickActionIcon} />
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    backgroundColor: "#1C1C1E",
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFF",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  metricsContainer: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 6,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  metricCardHighlight: {
    backgroundColor: "#FFE5E5",
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 11,
    color: "#666",
    textAlign: "center",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  section: {
    marginHorizontal: 12,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#1C1C1E",
  },
  itemCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  itemTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  itemDescription: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  itemDue: {
    fontSize: 11,
    color: "#999",
    marginTop: 8,
  },
  itemAction: {
    marginTop: 8,
    paddingVertical: 4,
  },
  itemActionText: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "600",
  },
  approvalCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  approvalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  approvalType: {
    fontSize: 11,
    fontWeight: "700",
    color: "#007AFF",
    backgroundColor: "#E5F4FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  approvalExpires: {
    fontSize: 11,
    fontWeight: "600",
  },
  approvalTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  approvalDescription: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
  },
  approvalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  approveButton: {
    flex: 1,
    backgroundColor: "#34C759",
    borderRadius: 8,
    paddingVertical: 8,
    marginRight: 6,
    alignItems: "center",
  },
  approveButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  rejectButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 12,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickActionButton: {
    width: "48%",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionIcon: {
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1C1C1E",
    textAlign: "center",
  },
  footer: {
    backgroundColor: "#F9F9F9",
    padding: 12,
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  footerText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  footerHint: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    marginTop: 4,
  },
});
