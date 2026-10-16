/**
 * useStreamingChat
 *
 * React hook that manages the full conversation state and exposes:
 *   messages       – current message list
 *   isStreaming    – true while the LLM is generating
 *   sendMessage    – submit a new user message
 *   clearHistory   – wipe the conversation
 *   stopStreaming   – abort mid-stream
 *
 * Works with the optional Convex sync layer via an injected syncFn.
 */

import { useState, useCallback, useRef } from "react";
import { nanoid } from "../../utils/nanoid";
import type { Message } from "../../types";
import { llmClient } from "./LLMClient";
import { MAX_CONTEXT_MESSAGES } from "../../constants";

interface UseStreamingChatOptions {
  /** Injected by the Convex sync layer when available */
  onMessagePersist?: (msg: Message) => Promise<void>;
  /** Conversation ID for sync tracking */
  conversationId?: string;
}

export function useStreamingChat(opts: UseStreamingChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      setError(null);
      abortRef.current = false;

      const userMsg: Message = {
        id: nanoid(),
        role: "user",
        content: text.trim(),
        createdAt: Date.now(),
      };

      // Append user message
      setMessages((prev) => {
        const updated = [...prev, userMsg];
        // Keep rolling window
        return updated.slice(-MAX_CONTEXT_MESSAGES);
      });

      // Persist to sync layer if available
      await opts.onMessagePersist?.(userMsg);

      // Placeholder assistant message (streams into)
      const assistantId = nanoid();
      const placeholder: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, placeholder]);
      setIsStreaming(true);

      // Build context for the LLM (exclude the empty placeholder)
      const contextMessages: Message[] = [];
      setMessages((prev) => {
        const withoutPlaceholder = prev.filter((m) => m.id !== assistantId);
        contextMessages.push(...withoutPlaceholder);
        return prev; // don't change state here, just read
      });

      // We need a synchronous snapshot; re-derive from captured userMsg
      const snapshot = [...messages, userMsg];

      await llmClient.stream(snapshot, {
        onToken: (delta) => {
          if (abortRef.current) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + delta }
                : m
            )
          );
        },

        onDone: async (fullText) => {
          const finalMsg: Message = {
            id: assistantId,
            role: "assistant",
            content: fullText,
            createdAt: Date.now(),
            isStreaming: false,
          };

          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? finalMsg : m))
          );
          setIsStreaming(false);
          await opts.onMessagePersist?.(finalMsg);
        },

        onError: (err) => {
          setIsStreaming(false);
          setError(err.message);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: `⚠️ ${err.message}`,
                    isStreaming: false,
                  }
                : m
            )
          );
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStreaming, messages, opts]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current = true;
    setIsStreaming(false);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
    abortRef.current = false;
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearHistory,
  };
}
