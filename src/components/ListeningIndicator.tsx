/**
 * ListeningIndicator
 *
 * The always-visible ADAMS status badge shown in the main voice screen.
 * It cycles through states with animated rings, colors, and labels.
 *
 * States:
 *   idle       – grey, static ring      "ADAMS is off"
 *   standby    – dim blue, slow pulse   "Listening for "Hey Adams""
 *   triggered  – bright blue, fast ring "Wake word detected"
 *   capturing  – animated waveform      "Listening…"
 *   processing – spinner                "Thinking…"
 *   error      – red                    "Something went wrong"
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  Platform,
} from "react-native";
import type { ListeningState } from "../types";

interface Props {
  state: ListeningState;
  interimTranscript?: string;
}

const STATE_CONFIG: Record<
  ListeningState,
  { color: string; label: string; pulse: boolean; fast: boolean }
> = {
  idle:       { color: "#3a3a4a", label: "ADAMS is off",              pulse: false, fast: false },
  standby:    { color: "#1d4ed8", label: 'Say "Hey Adams"',            pulse: true,  fast: false },
  triggered:  { color: "#3b82f6", label: "Wake word detected",         pulse: true,  fast: true  },
  capturing:  { color: "#06b6d4", label: "Listening…",                 pulse: true,  fast: true  },
  processing: { color: "#8b5cf6", label: "Thinking…",                  pulse: true,  fast: true  },
  error:      { color: "#ef4444", label: "Something went wrong",       pulse: false, fast: false },
};

export function ListeningIndicator({ state, interimTranscript }: Props) {
  const cfg = STATE_CONFIG[state];

  // Ring 1 (inner)
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.6)).current;

  // Ring 2 (outer)
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.3)).current;

  // Core pulse
  const coreScale = useRef(new Animated.Value(1)).current;

  // Spinner rotation
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);
  const ringLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Clear previous animations
    spinLoop.current?.stop();
    ringLoop.current?.stop();

    if (state === "processing") {
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinLoop.current.start();
      return;
    }

    spinAnim.setValue(0);

    if (!cfg.pulse) {
      ring1Scale.setValue(1);
      ring1Opacity.setValue(0);
      ring2Scale.setValue(1);
      ring2Opacity.setValue(0);
      coreScale.setValue(1);
      return;
    }

    const duration = cfg.fast ? 700 : 1600;

    ringLoop.current = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring1Scale, {
            toValue: 1.6,
            duration,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring1Scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(ring1Opacity, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(ring1Opacity, {
            toValue: 0.5,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(duration * 0.3),
          Animated.timing(ring2Scale, {
            toValue: 2.0,
            duration: duration * 1.2,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring2Scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(duration * 0.3),
          Animated.timing(ring2Opacity, {
            toValue: 0,
            duration: duration * 1.2,
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0.25,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(coreScale, {
            toValue: cfg.fast ? 1.12 : 1.06,
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(coreScale, {
            toValue: 1,
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    ringLoop.current.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const spinRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const showTranscript = (state === "capturing" || state === "triggered") && interimTranscript;

  return (
    <View style={styles.container}>
      {/* Ripple rings */}
      <Animated.View
        style={[
          styles.ring,
          styles.ring2,
          {
            borderColor: cfg.color,
            opacity: ring2Opacity,
            transform: [{ scale: ring2Scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          styles.ring1,
          {
            borderColor: cfg.color,
            opacity: ring1Opacity,
            transform: [{ scale: ring1Scale }],
          },
        ]}
      />

      {/* Core orb */}
      <Animated.View
        style={[
          styles.core,
          { backgroundColor: cfg.color, transform: [{ scale: coreScale }] },
        ]}
      >
        {state === "processing" ? (
          <Animated.View
            style={[
              styles.spinnerRing,
              { transform: [{ rotate: spinRotate }] },
            ]}
          />
        ) : (
          <View style={styles.orbInner} />
        )}
      </Animated.View>

      {/* Label */}
      <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>

      {/* Live transcript */}
      {showTranscript && (
        <Text style={styles.transcript} numberOfLines={2}>
          "{interimTranscript}"
        </Text>
      )}
    </View>
  );
}

const CORE = 80;
const RING1 = 110;
const RING2 = 140;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    minHeight: 200,
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    borderRadius: 999,
  },
  ring1: {
    width: RING1,
    height: RING1,
  },
  ring2: {
    width: RING2,
    height: RING2,
  },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    shadowOpacity: 0.6,
    elevation: 12,
  },
  orbInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  spinnerRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "transparent",
    borderTopColor: "rgba(255,255,255,0.8)",
  },
  label: {
    marginTop: 28,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    opacity: 0.85,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } : {}),
  },
  transcript: {
    marginTop: 12,
    fontSize: 15,
    color: "rgba(232,232,240,0.7)",
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 24,
    maxWidth: 280,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } : {}),
  },
});
