import { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { setUserMode } from "../services/api";

type Props = {
  userId: string;
  enabled: boolean;
  onModeChanged: (mode: "assist" | "autonomous") => void;
};

export default function ModeToggle({ userId, enabled, onModeChanged }: Props) {
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const nextMode = enabled ? "assist" : "autonomous";
    setLoading(true);
    try {
      await setUserMode(userId, nextMode);
      onModeChanged(nextMode);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{enabled ? "Autonomous Mode" : "Assist Mode"}</Text>
      <Switch value={enabled} onValueChange={() => void toggle()} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 10,
  },
  label: {
    color: "#e2e8f0",
    fontWeight: "600",
  },
});