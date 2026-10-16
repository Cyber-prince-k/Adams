/**
 * PrivacyToggle
 *
 * A clearly visible on/off switch for the wake word listener.
 * Shows privacy-first messaging when disabled.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";

interface Props {
  enabled: boolean;
  onToggle: () => void;
}

export function PrivacyToggle({ enabled, onToggle }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.textGroup}>
          <Text style={styles.title}>Always Listening</Text>
          <Text style={styles.subtitle}>
            {enabled
              ? "Microphone active for wake word only — no audio sent to cloud"
              : "Wake word disabled — ADAMS is fully silent"}
          </Text>
        </View>

        {/* Toggle pill */}
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.8}
          style={[styles.pill, enabled ? styles.pillOn : styles.pillOff]}
          accessibilityRole="switch"
          accessibilityLabel={
            enabled ? "Disable always listening" : "Enable always listening"
          }
          accessibilityState={{ checked: enabled }}
        >
          <View style={[styles.thumb, enabled ? styles.thumbOn : styles.thumbOff]} />
        </TouchableOpacity>
      </View>

      {/* Privacy note */}
      <View style={styles.privacyNote}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={styles.privacyText}>
          Wake word detection is 100% on-device. No audio ever leaves your device
          until you give a command.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(26, 26, 36, 0.9)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(42, 42, 58, 0.8)",
    marginHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e8e8f0",
    marginBottom: 3,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } : {}),
  },
  subtitle: {
    fontSize: 12,
    color: "#6b6b80",
    lineHeight: 16,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } : {}),
  },

  // Toggle pill
  pill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    paddingHorizontal: 3,
    flexShrink: 0,
  },
  pillOn: {
    backgroundColor: "#3b82f6",
  },
  pillOff: {
    backgroundColor: "#2a2a3a",
    borderWidth: 1,
    borderColor: "#3a3a4a",
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    shadowOpacity: 0.3,
    elevation: 3,
  },
  thumbOn: {
    alignSelf: "flex-end",
  },
  thumbOff: {
    alignSelf: "flex-start",
  },

  // Privacy note
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(42, 42, 58, 0.6)",
    gap: 8,
  },
  privacyIcon: {
    fontSize: 13,
    lineHeight: 18,
  },
  privacyText: {
    flex: 1,
    fontSize: 11,
    color: "#4a4a5a",
    lineHeight: 16,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } : {}),
  },
});
