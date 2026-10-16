/**
 * Home screen — the ADAMS voice interface.
 *
 * Shows:
 *   • Animated listening indicator (orb + rings)
 *   • Live interim transcript
 *   • Privacy toggle (on/off)
 *   • Feedback toast for local command results
 *   • Navigation to chat screen (manual and via escalation)
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { ListeningIndicator } from "../src/components/ListeningIndicator";
import { PrivacyToggle } from "../src/components/PrivacyToggle";
import { VoiceOrchestrator } from "../src/modules/voice/VoiceOrchestrator";
import type { ListeningState } from "../src/types";

export default function HomeScreen() {
  const router = useRouter();

  const [listeningState, setListeningState] = useState<ListeningState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [wakeEnabled, setWakeEnabled] = useState(true);

  // ── Boot orchestrator ──────────────────────────────────────────────────────
  useEffect(() => {
    const sensitivity = parseFloat(
      process.env["EXPO_PUBLIC_WAKE_WORD_SENSITIVITY"] ?? "0.5"
    );

    VoiceOrchestrator.init(
      {
        onStateChange: (s) => {
          setListeningState(s);
          if (s !== "capturing" && s !== "triggered") {
            setInterimTranscript("");
          }
        },
        onPartialTranscript: (t) => setInterimTranscript(t),
        onLocalFeedback: (msg) => {
          setFeedbackMsg(msg);
          setTimeout(() => setFeedbackMsg(null), 3500);
        },
        onEscalateToChat: (transcript) => {
          router.push({ pathname: "/chat", params: { q: transcript } });
        },
        onError: (msg) => {
          setFeedbackMsg(`Error: ${msg}`);
          setTimeout(() => setFeedbackMsg(null), 4000);
        },
      },
      sensitivity
    );

    return () => {
      VoiceOrchestrator.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle wake word ───────────────────────────────────────────────────────
  const handleToggle = useCallback(async () => {
    if (wakeEnabled) {
      await VoiceOrchestrator.disable();
      setWakeEnabled(false);
    } else {
      await VoiceOrchestrator.enable();
      setWakeEnabled(true);
    }
  }, [wakeEnabled]);

  // ── Manual mic tap ─────────────────────────────────────────────────────────
  const handleMicTap = useCallback(() => {
    VoiceOrchestrator.triggerManually();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>ADAMS</Text>
          <Text style={styles.subtitle}>Adaptive Digital Assistant</Text>
        </View>

        {/* Orb */}
        <TouchableOpacity
          onPress={handleMicTap}
          activeOpacity={0.9}
          accessibilityLabel="Tap to activate voice command"
          accessibilityRole="button"
          style={styles.orbTouchZone}
        >
          <ListeningIndicator
            state={listeningState}
            interimTranscript={interimTranscript}
          />
          {(listeningState === "standby" || listeningState === "idle") && (
            <Text style={styles.tapHint}>
              {wakeEnabled ? "Tap or say "Hey Adams"" : "Tap to speak"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Feedback toast */}
        {feedbackMsg && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{feedbackMsg}</Text>
          </View>
        )}

        {/* Privacy toggle */}
        <PrivacyToggle enabled={wakeEnabled} onToggle={handleToggle} />

        {/* Chat shortcut */}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => router.push("/chat")}
          accessibilityRole="button"
          accessibilityLabel="Open chat"
        >
          <Text style={styles.chatBtnText}>💬  Open Chat</Text>
        </TouchableOpacity>

        {/* Settings shortcut */}
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text style={styles.settingsBtnText}>⚙  Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: Platform.OS === "web" ? 48 : 24,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    alignItems: "center",
  },
  wordmark: {
    fontSize: 36,
    fontWeight: "800",
    color: "#3b82f6",
    letterSpacing: 8,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  subtitle: {
    fontSize: 11,
    color: "#4a4a5a",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginTop: 4,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  orbTouchZone: {
    alignItems: "center",
    width: "100%",
  },
  tapHint: {
    fontSize: 12,
    color: "#3a3a4a",
    marginTop: -8,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  toast: {
    backgroundColor: "#1a1a24",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2a2a3a",
    maxWidth: 320,
  },
  toastText: {
    fontSize: 14,
    color: "#e8e8f0",
    textAlign: "center",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  chatBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    width: 260,
    alignItems: "center",
  },
  chatBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  settingsBtn: {
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
    width: 260,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2a3a",
  },
  settingsBtnText: {
    fontSize: 14,
    color: "#6b6b80",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
});
