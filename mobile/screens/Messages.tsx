import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { sendVoiceCommand } from "../services/api";

export default function MessagesScreen() {
  const [command, setCommand] = useState("Reply to client");
  const [response, setResponse] = useState("");

  async function submit() {
    try {
      const result = await sendVoiceCommand(command);
      setResponse(`${result.action}: ${result.message}`);
    } catch (error) {
      setResponse(error instanceof Error ? error.message : "Command failed");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Messages</Text>
      <Text style={styles.copy}>Send quick command to AI assistant.</Text>
      <TextInput style={styles.input} value={command} onChangeText={setCommand} />
      <Button title="Send Command" onPress={submit} />
      {response ? <Text style={styles.result}>{response}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 10 },
  header: { color: "#f8fafc", fontSize: 22, fontWeight: "700" },
  copy: { color: "#cbd5e1" },
  input: {
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    padding: 10,
    color: "#f8fafc",
    backgroundColor: "#0f172a",
  },
  result: { color: "#93c5fd" },
});
