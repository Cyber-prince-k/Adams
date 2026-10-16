/**
 * ChatInput
 *
 * The prompt composer bar at the bottom of the chat screen.
 * Features: auto-grow textarea, send button, stop-streaming button,
 * keyboard-aware positioning, voice mic shortcut.
 */

import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Text,
} from "react-native";

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  onVoice?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  prefillText?: string;
}

export function ChatInput({
  onSend,
  onStop,
  onVoice,
  isStreaming,
  disabled = false,
  placeholder = "Message ADAMS…",
  prefillText,
}: Props) {
  const [text, setText] = useState(prefillText ?? "");
  const inputRef = useRef<TextInput>(null);

  // Apply prefill whenever it changes (e.g., voice escalation injects a transcript)
  React.useEffect(() => {
    if (prefillText) {
      setText(prefillText);
      // Auto-focus after prefill so user can edit or just hit send
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [prefillText]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyPress = (e: { nativeEvent: { key: string; shiftKey?: boolean } }) => {
    // Desktop web: Enter sends, Shift+Enter inserts newline
    if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
      handleSend();
    }
  };

  const canSend = text.trim().length > 0 && !isStreaming && !disabled;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <View style={styles.container}>
        <View style={styles.inputRow}>
          {/* Voice shortcut button (mobile only) */}
          {onVoice && Platform.OS !== "web" && (
            <TouchableOpacity
              onPress={onVoice}
              style={styles.iconBtn}
              accessibilityLabel="Voice input"
              accessibilityRole="button"
            >
              <Text style={styles.iconText}>🎙</Text>
            </TouchableOpacity>
          )}

          {/* Text field */}
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            placeholderTextColor="#4a4a5a"
            multiline
            maxLength={4000}
            editable={!disabled}
            returnKeyType="send"
            onSubmitEditing={Platform.OS !== "web" ? handleSend : undefined}
            blurOnSubmit={false}
            accessibilityLabel="Message input"
          />

          {/* Send / Stop button */}
          {isStreaming ? (
            <TouchableOpacity
              onPress={onStop}
              style={[styles.sendBtn, styles.stopBtn]}
              accessibilityLabel="Stop generating"
              accessibilityRole="button"
            >
              <View style={styles.stopIcon} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSend}
              style={[styles.sendBtn, canSend ? styles.sendBtnActive : styles.sendBtnDisabled]}
              disabled={!canSend}
              accessibilityLabel="Send message"
              accessibilityRole="button"
            >
              {disabled ? (
                <ActivityIndicator size="small" color="#6b6b80" />
              ) : (
                <Text style={[styles.sendIcon, canSend && styles.sendIconActive]}>↑</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Footer hint */}
        {Platform.OS === "web" && (
          <Text style={styles.hint}>
            Enter to send · Shift+Enter for new line
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111118",
    borderTopWidth: 1,
    borderTopColor: "#2a2a3a",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: "#1a1a24",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2a2a3a",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#e8e8f0",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 8 : 6,
    paddingBottom: Platform.OS === "ios" ? 8 : 6,
    maxHeight: 120,
    minHeight: 36,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          fontFamily: "system-ui, sans-serif",
          resize: "none",
        } as object)
      : {}),
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnActive: {
    backgroundColor: "#3b82f6",
  },
  sendBtnDisabled: {
    backgroundColor: "#2a2a3a",
  },
  stopBtn: {
    backgroundColor: "#ef4444",
  },
  sendIcon: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4a4a5a",
    lineHeight: 22,
  },
  sendIconActive: {
    color: "#ffffff",
  },
  stopIcon: {
    width: 12,
    height: 12,
    backgroundColor: "#ffffff",
    borderRadius: 2,
  },
  hint: {
    fontSize: 10,
    color: "#3a3a4a",
    textAlign: "center",
    marginTop: 6,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
});
