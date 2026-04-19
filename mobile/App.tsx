import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View, Pressable } from "react-native";
import EarningsScreen from "./screens/Earnings";
import HomeScreen from "./screens/Home";
import JobsScreen from "./screens/Jobs";
import MessagesScreen from "./screens/Messages";
import ProfileScreen from "./screens/Profile";
import ModeToggle from "./components/ModeToggle";
import { getUserMode } from "./services/api";
import { registerForPushNotifications } from "./services/notifications";

type ScreenKey = "home" | "jobs" | "earnings" | "messages" | "profile";

const demoUser = {
  id: "user-001",
  email: "you@example.com",
};

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [mode, setMode] = useState<"assist" | "autonomous">("assist");
  const [modeNotice, setModeNotice] = useState("I will guide you.");

  useEffect(() => {
    void registerForPushNotifications();

    void (async () => {
      try {
        const current = await getUserMode(demoUser.id);
        setMode(current.mode);
        setModeNotice(current.mode === "autonomous" ? "I am working for you." : "I will guide you.");
      } catch {
        setMode("assist");
      }
    })();
  }, []);

  function handleVoiceAction(action: string) {
    if (action === "fetch_jobs" || action === "auto_apply") {
      setScreen("jobs");
      return;
    }

    if (action === "reply_client") {
      setScreen("messages");
      return;
    }

    if (action === "check_earnings") {
      setScreen("earnings");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>AI Income Assistant</Text>
        <ModeToggle
          userId={demoUser.id}
          enabled={mode === "autonomous"}
          onModeChanged={(newMode) => {
            setMode(newMode);
            setModeNotice(
              newMode === "autonomous"
                ? "Autonomous mode active. I started applying to jobs for you."
                : "Assist mode active. I will wait for your instructions."
            );
          }}
        />
        <Text style={styles.modeNotice}>{modeNotice}</Text>

        {screen === "home" ? (
          <HomeScreen
            userId={demoUser.id}
            mode={mode}
            onGoJobs={() => setScreen("jobs")}
            onGoEarnings={() => setScreen("earnings")}
            onGoMessages={() => setScreen("messages")}
            onVoiceAction={handleVoiceAction}
          />
        ) : null}
        {screen === "jobs" ? <JobsScreen userId={demoUser.id} /> : null}
        {screen === "earnings" ? <EarningsScreen userId={demoUser.id} /> : null}
        {screen === "messages" ? <MessagesScreen /> : null}
        {screen === "profile" ? <ProfileScreen userEmail={demoUser.email} /> : null}

        <View style={styles.nav}>
          <TabButton label="Home" active={screen === "home"} onPress={() => setScreen("home")} />
          <TabButton label="Jobs" active={screen === "jobs"} onPress={() => setScreen("jobs")} />
          <TabButton label="Earnings" active={screen === "earnings"} onPress={() => setScreen("earnings")} />
          <TabButton label="Messages" active={screen === "messages"} onPress={() => setScreen("messages")} />
          <TabButton label="Profile" active={screen === "profile"} onPress={() => setScreen("profile")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

type TabButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function TabButton({ label, active, onPress }: TabButtonProps) {
  return (
    <Pressable style={[styles.tab, active ? styles.tabActive : null]} onPress={onPress}>
      <Text style={active ? styles.tabTextActive : styles.tabText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  brand: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 4,
  },
  modeNotice: {
    color: "#93c5fd",
    fontSize: 12,
    marginTop: -4,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: "auto",
  },
  tab: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#111827",
  },
  tabActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#60a5fa",
  },
  tabText: {
    color: "#cbd5e1",
    fontSize: 12,
  },
  tabTextActive: {
    color: "#eff6ff",
    fontSize: 12,
    fontWeight: "700",
  },
});
