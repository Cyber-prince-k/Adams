// ─── App-wide constants ──────────────────────────────────────────────────────

export const APP_NAME = "ADAMS";
export const APP_FULL_NAME = "Adaptive Digital Assistant & Management System";
export const WAKE_WORD = "hey adams";
export const WAKE_WORD_VARIANTS = [
  "hey adams",
  "hey adam",
  "adams",
  "ok adams",
  "hi adams",
];

// Background task identifiers
export const WAKE_WORD_TASK_ID = "com.adams.wakeword";
export const BACKGROUND_FETCH_TASK_ID = "com.adams.background-fetch";

// Voice capture
export const VOICE_TIMEOUT_MS = 8000; // stop listening after 8 s of silence
export const VOICE_MAX_DURATION_MS = 30000; // hard cap at 30 s

// LLM
export const DEFAULT_SYSTEM_PROMPT = `You are ADAMS (Adaptive Digital Assistant & Management System), a highly capable AI assistant inspired by J.A.R.V.I.S. You are intelligent, concise, helpful, and slightly witty. You assist with any question, task, or request. When answering, be direct and clear. Format responses in markdown when appropriate. Today's date is ${new Date().toDateString()}.`;

export const MAX_CONTEXT_MESSAGES = 40; // rolling window kept in memory
export const STREAM_THROTTLE_MS = 33; // ~30 fps token updates

// Local command categories
export const LOCAL_INTENTS = [
  "flashlight",
  "call",
  "music",
  "launch_app",
  "volume",
  "brightness",
  "timer",
  "alarm",
] as const;

export type LocalIntent = (typeof LOCAL_INTENTS)[number];
