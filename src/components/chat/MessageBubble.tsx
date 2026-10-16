/**
 * MessageBubble
 *
 * Renders a single chat message with:
 *   • User messages   — right-aligned, accent-blue pill
 *   • Assistant msgs  — left-aligned, dark surface, markdown rendered
 *   • Streaming shimmer while isStreaming=true
 *   • Timestamp on press (long-press)
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import type { Message } from "../../types";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface Props {
  message: Message;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({ message }: Props) {
  const [showTime, setShowTime] = useState(false);
  const isUser = message.role === "user";

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>
      )}

      <TouchableOpacity
        onLongPress={() => setShowTime((v) => !v)}
        activeOpacity={0.9}
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
        accessibilityLabel={`${message.role}: ${message.content}`}
      >
        {isUser ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          <>
            <MarkdownRenderer content={message.content} />
            {message.isStreaming && (
              <StreamingCursor />
            )}
          </>
        )}

        {showTime && (
          <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAssistant]}>
            {formatTime(message.createdAt)}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function StreamingCursor() {
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.Text style={[styles.cursor, { opacity }]}>▋</Animated.Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "flex-end",
    gap: 8,
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  rowAssistant: {
    justifyContent: "flex-start",
  },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },

  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: "#1d4ed8",
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: "#1a1a24",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#2a2a3a",
  },

  userText: {
    fontSize: 15,
    color: "#ffffff",
    lineHeight: 21,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },

  cursor: {
    fontSize: 14,
    color: "#3b82f6",
    marginTop: 2,
  },

  timestamp: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.55,
  },
  timestampUser: {
    color: "#c0d0ff",
    textAlign: "right",
  },
  timestampAssistant: {
    color: "#6b6b80",
    textAlign: "left",
  },
});
