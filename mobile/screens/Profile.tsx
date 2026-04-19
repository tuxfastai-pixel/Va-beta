import { StyleSheet, Text, View } from "react-native";

type Props = {
  userEmail: string;
};

export default function ProfileScreen({ userEmail }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Profile</Text>
      <Text style={styles.meta}>Identity: {userEmail}</Text>
      <Text style={styles.meta}>Status: AI worker active</Text>
      <Text style={styles.meta}>Plan: Starter</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 8 },
  header: { color: "#f8fafc", fontSize: 22, fontWeight: "700" },
  meta: { color: "#cbd5e1" },
});
