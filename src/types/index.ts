// ─── Shared type definitions ─────────────────────────────────────────────────

export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number; // Unix ms
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ─── Voice / Wake Word ───────────────────────────────────────────────────────

export type ListeningState =
  | "idle"       // wake word engine OFF
  | "standby"    // wake word engine on, waiting for trigger
  | "triggered"  // wake word detected, showing visual feedback
  | "capturing"  // recording user command
  | "processing" // sending to LLM or local parser
  | "error";     // something went wrong

export interface VoiceState {
  listeningState: ListeningState;
  transcript: string;
  interimTranscript: string;
  error: string | null;
}

// ─── Local Command Parser ────────────────────────────────────────────────────

export type LocalIntentType =
  | "flashlight_on"
  | "flashlight_off"
  | "flashlight_toggle"
  | "call"
  | "play_music"
  | "stop_music"
  | "launch_app"
  | "set_volume"
  | "set_alarm"
  | "set_timer"
  | "unknown";

export interface ParsedIntent {
  intent: LocalIntentType;
  confidence: number; // 0–1
  params: Record<string, string | number | boolean>;
  rawText: string;
  isLocal: boolean; // false → escalate to LLM
}

// ─── LLM ─────────────────────────────────────────────────────────────────────

export type LLMProvider = "openai" | "deepseek" | "ollama";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AdamsSettings {
  wakeWordEnabled: boolean;
  wakeWordSensitivity: number; // 0.0–1.0
  llmProvider: LLMProvider;
  llmModel: string;
  ttsEnabled: boolean;
  hapticFeedback: boolean;
  showListeningIndicator: boolean;
}
