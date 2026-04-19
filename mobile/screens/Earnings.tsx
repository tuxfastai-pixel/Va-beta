import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import { fetchEarnings } from "../services/api";

type Props = {
  userId: string;
};

export default function EarningsScreen({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [byCurrency, setByCurrency] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const loadEarnings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await fetchEarnings(userId);
      setTotal(Number(result.total || 0));
      setByCurrency(result.byCurrency || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load earnings");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Earnings Tracker</Text>
      <Text style={styles.total}>${total.toFixed(2)}</Text>
      {Object.entries(byCurrency).map(([code, amount]) => (
        <Text style={styles.meta} key={code}>
          {code}: ${Number(amount).toFixed(2)}
        </Text>
      ))}
      {loading ? <ActivityIndicator color="#38bdf8" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Refresh Earnings" onPress={loadEarnings} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 10 },
  header: { color: "#f8fafc", fontSize: 22, fontWeight: "700" },
  total: { color: "#22c55e", fontSize: 32, fontWeight: "700" },
  meta: { color: "#cbd5e1" },
  error: { color: "#fb7185" },
});
