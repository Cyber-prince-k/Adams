/**
 * LLMClient
 *
 * Unified streaming client that supports three providers:
 *   • OpenAI       (gpt-4o-mini, gpt-4o, etc.)
 *   • DeepSeek     (deepseek-chat, deepseek-coder)
 *   • Ollama       (any local model, default: http://localhost:11434)
 *
 * Each provider exposes the same interface:
 *   stream(messages, onToken, onDone, onError)
 *
 * The streaming is throttled to ~30 fps so React re-renders don't saturate
 * the JS thread (same technique as EvanBacon/chat-template).
 */

import type { Message, LLMProvider, LLMConfig } from "../../types";
import { DEFAULT_SYSTEM_PROMPT, STREAM_THROTTLE_MS } from "../../constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onToken: (delta: string) => void;
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
}

// ─── Provider base URL helpers ────────────────────────────────────────────────

function openAIBase(): string {
  return "https://api.openai.com/v1";
}

function deepSeekBase(): string {
  return "https://api.deepseek.com/v1";
}

function ollamaBase(): string {
  const base = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
  return `${base}/v1`;
}

function getAPIKey(provider: LLMProvider): string {
  switch (provider) {
    case "openai":
      return process.env["OPENAI_API_KEY"] ?? "";
    case "deepseek":
      return process.env["DEEPSEEK_API_KEY"] ?? "";
    case "ollama":
      return "ollama"; // Ollama doesn't check the key but the field is required
  }
}

function getBaseURL(provider: LLMProvider): string {
  switch (provider) {
    case "openai":
      return openAIBase();
    case "deepseek":
      return deepSeekBase();
    case "ollama":
      return ollamaBase();
  }
}

// ─── Mock streaming (dev / demo mode) ────────────────────────────────────────

async function mockStream(
  messages: Message[],
  callbacks: StreamCallbacks
): Promise<void> {
  const last = messages[messages.length - 1];
  const reply = `[MOCK] I received: "${last?.content ?? ""}". This is a simulated ADAMS response. Set EXPO_PUBLIC_MOCK_AI=0 and add your API key to enable real responses.`;

  let i = 0;
  let accumulated = "";
  const words = reply.split(" ");

  const tick = () => {
    if (i >= words.length) {
      callbacks.onDone(accumulated);
      return;
    }
    const token = (i === 0 ? "" : " ") + words[i]!;
    accumulated += token;
    callbacks.onToken(token);
    i++;
    setTimeout(tick, 60 + Math.random() * 40);
  };

  setTimeout(tick, 200);
}

// ─── Real streaming via fetch + SSE ──────────────────────────────────────────

interface OAIMessage {
  role: string;
  content: string;
}

async function realStream(
  config: LLMConfig,
  messages: Message[],
  callbacks: StreamCallbacks
): Promise<void> {
  const baseURL = getBaseURL(config.provider);
  const apiKey = getAPIKey(config.provider);

  const oaiMessages: OAIMessage[] = [
    { role: "system", content: DEFAULT_SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let response: Response;
  try {
    response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: oaiMessages,
        stream: true,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 2048,
      }),
    });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    callbacks.onError(new Error(`LLM API ${response.status}: ${errText}`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("Response body is not readable"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let lastFlush = Date.now();

  // Throttle buffer — collect tokens and flush at ~30fps
  let pendingDelta = "";

  const flush = (force = false) => {
    const now = Date.now();
    if (pendingDelta && (force || now - lastFlush >= STREAM_THROTTLE_MS)) {
      accumulated += pendingDelta;
      callbacks.onToken(pendingDelta);
      pendingDelta = "";
      lastFlush = now;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          flush(true);
          callbacks.onDone(accumulated);
          return;
        }

        try {
          const parsed = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            pendingDelta += delta;
            flush();
          }
        } catch {
          // malformed chunk — skip
        }
      }
    }

    flush(true);
    callbacks.onDone(accumulated);
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}

// ─── Public LLMClient ─────────────────────────────────────────────────────────

export class LLMClient {
  private config: LLMConfig;

  constructor(config?: Partial<LLMConfig>) {
    const provider =
      (process.env["EXPO_PUBLIC_LLM_PROVIDER"] as LLMProvider) ?? "openai";
    const model =
      process.env["EXPO_PUBLIC_LLM_MODEL"] ?? LLMClient.defaultModel(provider);

    this.config = {
      provider,
      model,
      temperature: 0.7,
      maxTokens: 2048,
      ...config,
    };
  }

  updateConfig(partial: Partial<LLMConfig>) {
    this.config = { ...this.config, ...partial };
  }

  get currentConfig(): LLMConfig {
    return { ...this.config };
  }

  async stream(messages: Message[], callbacks: StreamCallbacks): Promise<void> {
    const mockMode = process.env["EXPO_PUBLIC_MOCK_AI"] === "1";
    if (mockMode) {
      await mockStream(messages, callbacks);
    } else {
      await realStream(this.config, messages, callbacks);
    }
  }

  static defaultModel(provider: LLMProvider): string {
    switch (provider) {
      case "openai":
        return "gpt-4o-mini";
      case "deepseek":
        return "deepseek-chat";
      case "ollama":
        return "llama3.2";
    }
  }
}

export const llmClient = new LLMClient();
