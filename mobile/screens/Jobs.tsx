import { useEffect, useState } from "react";
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from "react-native";
import { autoApply, fetchJobs, type Job } from "../services/api";

type Props = {
  userId: string;
};

export default function JobsScreen({ userId }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function loadJobs() {
    try {
      setLoading(true);
      const data = await fetchJobs();
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }

  async function runAutoApply() {
    try {
      setStatus("Applying to jobs...");
      const result = await autoApply({ userId });
      setStatus(result.status || "Applications queued.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Auto-apply failed");
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Jobs</Text>
      <View style={styles.actions}>
        <Button title="Refresh" onPress={loadJobs} />
        <Button title="One-Click Apply" onPress={runAutoApply} />
      </View>
      {loading ? <ActivityIndicator color="#38bdf8" /> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <FlatList
        data={jobs}
        keyExtractor={(item, index) => item.id || `${index}`}
        renderItem={({ item }) => (
          <View style={styles.jobCard}>
            <Text style={styles.jobTitle}>{item.title || "Untitled job"}</Text>
            <Text style={styles.jobMeta}>{item.company || "Unknown company"}</Text>
            <Text style={styles.jobMeta}>${Number(item.pay_amount || 0).toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  header: { color: "#f8fafc", fontSize: 22, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8, marginBottom: 8 },
  status: { color: "#facc15" },
  jobCard: {
    borderRadius: 12,
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "#334155",
    padding: 12,
    marginBottom: 10,
  },
  jobTitle: { color: "#f8fafc", fontWeight: "600" },
  jobMeta: { color: "#94a3b8" },
});
