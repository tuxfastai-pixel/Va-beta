import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import type { Audio } from "expo-av";
import { sendVoiceAudio } from "../services/api";
import { playAudioFromBase64 } from "../services/playAudio";
import { recordAudio, stopRecording } from "../services/voiceRecorder";

type Props = {
  userId: string;
  mode: "assist" | "autonomous";
  onGoJobs: () => void;
  onGoEarnings: () => void;
  onGoMessages: () => void;
  onVoiceAction: (action: string) => void;
};

export default function HomeScreen({ userId, mode, onGoJobs, onGoEarnings, onGoMessages, onVoiceAction }: Props) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceStatus, setVoiceStatus] = useState("");

  async function start() {
    try {
      setVoiceStatus("Recording...");
      const rec = await recordAudio();
      setRecording(rec);
    } catch (error) {
      setVoiceStatus(error instanceof Error ? error.message : "Could not start recording");
    }
  }

  async function stopAndSend() {
    if (!recording) {
      setVoiceStatus("Start recording first.");
      return;
    }

    try {
      setVoiceStatus("Processing...");
      const uri = await stopRecording(recording);
      setRecording(null);

      const data = await sendVoiceAudio(uri, userId);
      setVoiceStatus(`You said: ${data.text}\nAI: ${data.reply}`);

      onVoiceAction(data.action);

      if (data.ttsBase64) {
        await playAudioFromBase64(data.ttsBase64);
      }
    } catch (error) {
      setVoiceStatus(error instanceof Error ? error.message : "Voice request failed");
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>AI Income Assistant</Text>
      <Text style={styles.subtitle}>Your daily control room for jobs, applications, and payments.</Text>
      <Text style={styles.modeBadge}>{mode === "autonomous" ? "I am working for you." : "I will guide you."}</Text>
      <View style={styles.row}>
        <Button title="Find Jobs" onPress={onGoJobs} />
      </View>
      <View style={styles.row}>
        <Button title="View Earnings" onPress={onGoEarnings} />
      </View>
      <View style={styles.row}>
        <Button title="Messages" onPress={onGoMessages} />
      </View>
      <View style={styles.row}>
        <Button title="Start Talking" onPress={() => void start()} />
      </View>
      <View style={styles.row}>
        <Button title="Stop and Send" onPress={() => void stopAndSend()} />
      </View>
      {voiceStatus ? <Text style={styles.voiceStatus}>{voiceStatus}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#101827",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
    marginBottom: 8,
  },
  modeBadge: {
    color: "#a5b4fc",
    fontSize: 12,
  },
  row: {
    marginTop: 8,
  },
  voiceStatus: {
    marginTop: 10,
    color: "#93c5fd",
    fontSize: 12,
    lineHeight: 18,
  },
});
