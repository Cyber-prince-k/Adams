/**
 * Chat screen — the full ADAMS conversational interface.
 *
 * Accepts an optional `q` search param (the escalated voice transcript)
 * and pre-fills + auto-sends it so the flow is seamless.
 *
 * Layout (web): sidebar (conversation list) + main chat column
 * Layout (mobile): full-screen chat, back button returns to voice screen
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessageBubble } from "../src/components/chat/MessageBubble";
import { ChatInput } from "../src/components/chat/ChatInput";
import { useStreamingChat } from "../src/modules/llm/useStreamingChat";
import { ConversationSync } from "../src/modules/sync/ConversationSync";
import { nanoid } from "../src/utils/nanoid";
import type { Message } from "../src/types";

// Each chat session gets a stable ID for Convex sync
const SESSION_ID = nanoid();

export default function ChatScreen() {
  const router = useRouter();
  const { q: escalatedQuery } = useLocalSearchParams<{ q?: string }>();

  // Convex sync (no-op when CONVEX_URL not configured)
  const syncRef = useRef(new ConversationSync(SESSION_ID));

  const { messages, isStreaming, error, sendMessage, stopStreaming, clearHistory } =
    useStreamingChat({
      conversationId: SESSION_ID,
      onMessagePersist: async (msg: Message) => {
        await syncRef.current.persist(msg);
      },
    });

  const listRef = useRef<FlatList>(null);
  const [prefill, setPrefill] = useState<string | undefined>(undefined);
  const autoSentRef = useRef(false);

  // Handle voice escalation query
  useEffect(() => {
    if (escalatedQuery && !autoSentRef.current) {
      autoSentRef.current = true;
      // Small delay so the screen is fully mounted
      setTimeout(() => {
        sendMessage(escalatedQuery);
      }, 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escalatedQuery]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      setPrefill(undefined);
      sendMessage(text);
    },
    [sendMessage]
  );

  const handleVoiceShortcut = useCallback(() => {
    router.back();
  }, [router]);

  const handleClear = useCallback(async () => {
    clearHistory();
    await syncRef.current.clear();
  }, [clearHistory]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => <MessageBubble message={item} />,
    []
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <View style={styles.statusDot} />
            <Text style={styles.modelLabel}>
              {process.env["EXPO_PUBLIC_LLM_PROVIDER"] ?? "openai"} ·{" "}
              {process.env["EXPO_PUBLIC_LLM_MODEL"] ?? "gpt-4o-mini"}
            </Text>
          </View>
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn} accessibilityLabel="Clear conversation">
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* ── Message list ── */}
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {/* ── Error banner ── */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        )}

        {/* ── Input ── */}
        <ChatInput
          onSend={handleSend}
          onStop={stopStreaming}
          onVoice={Platform.OS !== "web" ? handleVoiceShortcut : undefined}
          isStreaming={isStreaming}
          prefillText={prefill}
        />
      </View>
    </SafeAreaView>
  );
}

function EmptyState() {
  const suggestions = [
    "What's the weather like in Tokyo?",
    "Explain quantum entanglement simply",
    "Write a haiku about the ocean",
    "What can you help me with?",
  ];

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>⬡</Text>
      <Text style={styles.emptyTitle}>How can I help?</Text>
      <Text style={styles.emptySubtitle}>
        Ask me anything, or say "Hey Adams" to use your voice.
      </Text>
      <View style={styles.suggestions}>
        {suggestions.map((s, i) => (
          <View key={i} style={styles.suggestion}>
            <Text style={styles.suggestionText}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a24",
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  modelLabel: {
    fontSize: 12,
    color: "#4a4a5a",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a3a",
  },
  clearBtnText: {
    fontSize: 12,
    color: "#6b6b80",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },

  listContent: {
    paddingVertical: 12,
    gap: 2,
    flexGrow: 1,
  },

  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(239,68,68,0.3)",
  },
  errorText: {
    fontSize: 13,
    color: "#f87171",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
    color: "#1d4ed8",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e8e8f0",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#4a4a5a",
    textAlign: "center",
    lineHeight: 21,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  suggestions: {
    marginTop: 16,
    gap: 8,
    width: "100%",
    maxWidth: 360,
  },
  suggestion: {
    backgroundColor: "#111118",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2a2a3a",
  },
  suggestionText: {
    fontSize: 13,
    color: "#6b6b80",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
});
