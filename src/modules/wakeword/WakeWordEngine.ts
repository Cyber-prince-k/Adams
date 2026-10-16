/**
 * WakeWordEngine
 *
 * Always-on wake word detection with three backends, selected automatically:
 *
 *   1. NitroWakeWord (native Nitro Module)
 *      → Best: truly continuous, ~5% CPU, dedicated audio pipeline
 *      → Available after: `npx expo run:ios / run:android` with the module linked
 *
 *   2. WebSpeechBackend (browser SpeechRecognition API)
 *      → Web only; continuous interim-results mode, auto-restarts on end
 *
 *   3. VoicePollBackend (@react-native-voice/voice)
 *      → Software fallback for native custom builds without NitroWakeWord
 *      → Runs a tight restart loop with:
 *          • 200 ms de-bounce so one phrase can't double-fire
 *          • Exponential back-off on repeated errors
 *          • Audio session management via expo-av so it survives interruptions
 *          • Partial-result scanning every recognition cycle
 */

import { Platform } from "react-native";
import { WAKE_WORD_VARIANTS } from "../../constants";

export type WakeWordCallback = () => void;
export type ErrorCallback = (err: Error) => void;

export interface WakeWordEngineOptions {
  /** 0.0 = permissive  1.0 = strict. Default 0.5 */
  sensitivity?: number;
  onDetected: WakeWordCallback;
  onError?: ErrorCallback;
}

// ─── Lazy-load NitroWakeWord ──────────────────────────────────────────────────

let NitroWakeWord: {
  start: (opts: { sensitivity: number; keywords: string[] }) => Promise<void>;
  stop: () => Promise<void>;
  addListener: (event: "onKeyword", cb: () => void) => { remove: () => void };
} | null = null;

try {
  if (Platform.OS !== "web") {
    NitroWakeWord = require("react-native-nitro-wakeword").NitroWakeWord;
  }
} catch {
  /* module not linked — will use software fallback */
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchesWakeWord(text: string, sensitivity: number): boolean {
  const lower = text.toLowerCase().trim();
  for (const variant of WAKE_WORD_VARIANTS) {
    if (sensitivity >= 0.8) {
      if (lower === variant) return true;
    } else if (sensitivity >= 0.5) {
      if (lower.includes(variant)) return true;
    } else {
      if (variant.split(" ").every((t) => lower.includes(t))) return true;
    }
  }
  return false;
}

// ─── Backend 2: Web Speech API ────────────────────────────────────────────────

class WebSpeechBackend {
  private recognition: SpeechRecognition | null = null;
  private running = false;
  private lastFiredAt = 0;

  constructor(private opts: WakeWordEngineOptions) {}

  start() {
    const SR =
      (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition })
        .SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition;

    if (!SR) {
      this.opts.onError?.(new Error("SpeechRecognition not supported"));
      return;
    }

    this.running = true;
    this.createAndStart(SR);
  }

  private createAndStart(SR: typeof SpeechRecognition) {
    if (!this.running) return;

    const r = new SR();
    this.recognition = r;
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";

    r.onresult = (e: SpeechRecognitionEvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (matchesWakeWord(text, this.opts.sensitivity ?? 0.5)) {
          this.fireDetection();
        }
      }
    };

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      this.opts.onError?.(new Error(`Web SR: ${e.error}`));
    };

    r.onend = () => {
      // Immediate restart — no gap
      if (this.running) setTimeout(() => this.createAndStart(SR), 50);
    };

    try {
      r.start();
    } catch {
      if (this.running) setTimeout(() => this.createAndStart(SR), 500);
    }
  }

  private fireDetection() {
    const now = Date.now();
    if (now - this.lastFiredAt < 1500) return; // de-bounce 1.5 s
    this.lastFiredAt = now;
    this.opts.onDetected();
  }

  stop() {
    this.running = false;
    try { this.recognition?.stop(); } catch { /* ignore */ }
    this.recognition = null;
  }
}

// ─── Backend 3: @react-native-voice/voice poll loop ──────────────────────────

const RESTART_DELAY_MS = 150;      // gap between sessions
const DEBOUNCE_MS      = 1500;     // minimum ms between two wake-word fires
const MAX_BACKOFF_MS   = 8000;     // cap on exponential back-off

class VoicePollBackend {
  private Voice: typeof import("@react-native-voice/voice").default | null = null;
  private running   = false;
  private lastFiredAt = 0;
  private backoffMs   = RESTART_DELAY_MS;
  private restartHandle: ReturnType<typeof setTimeout> | null = null;
  private sessionActive = false;

  constructor(private opts: WakeWordEngineOptions) {}

  async start(): Promise<void> {
    try {
      this.Voice = (await import("@react-native-voice/voice")).default;
    } catch {
      this.opts.onError?.(new Error("@react-native-voice/voice not linked"));
      return;
    }

    // Configure audio session on iOS so the mic survives screen lock / BT events
    await this.configureAudioSession();

    this.running = true;
    this.backoffMs = RESTART_DELAY_MS;
    this.attachHandlers();
    await this.beginSession();
  }

  // Attach all event handlers once — they persist across restarts
  private attachHandlers() {
    if (!this.Voice) return;

    this.Voice.onSpeechPartialResults = (e) => {
      if (!this.running || !this.sessionActive) return;
      const text = e.value?.[0] ?? "";
      if (matchesWakeWord(text, this.opts.sensitivity ?? 0.5)) {
        this.fireDetection();
      }
    };

    this.Voice.onSpeechResults = (e) => {
      if (!this.running || !this.sessionActive) return;
      const text = e.value?.[0] ?? "";
      if (matchesWakeWord(text, this.opts.sensitivity ?? 0.5)) {
        this.fireDetection();
      }
    };

    this.Voice.onSpeechEnd = () => {
      // Session ended naturally — restart after a short delay
      this.sessionActive = false;
      if (this.running) {
        this.scheduleRestart(this.backoffMs);
        // Reset back-off on clean end
        this.backoffMs = RESTART_DELAY_MS;
      }
    };

    this.Voice.onSpeechError = (e) => {
      this.sessionActive = false;
      const code = String((e.error as { code?: string })?.code ?? "");
      // Codes 6/7 = no-speech / no-match — expected, don't escalate
      const isBenign = code === "6" || code === "7" || code === "203";
      if (!isBenign) {
        this.opts.onError?.(new Error(`VoicePoll error ${code}`));
      }
      if (this.running) {
        // Apply back-off on repeated errors
        if (!isBenign) {
          this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
        }
        this.scheduleRestart(this.backoffMs);
      }
    };
  }

  private scheduleRestart(delayMs: number) {
    if (this.restartHandle) clearTimeout(this.restartHandle);
    this.restartHandle = setTimeout(() => {
      if (this.running) this.beginSession();
    }, delayMs);
  }

  private async beginSession() {
    if (!this.running || !this.Voice) return;
    if (this.sessionActive) return;

    try {
      await this.Voice.destroy();
      // Android uses Google recognizer extras; iOS SFSpeechRecognizer ignores them
      // but some versions throw on unrecognised keys — keep iOS options clean.
      const startOpts =
        Platform.OS === "android"
          ? {
              RECOGNIZER_ENGINE: "GOOGLE",
              EXTRA_PARTIAL_RESULTS: true,
              EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 500,
              EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1200,
              EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1000,
            }
          : {};
      await this.Voice.start("en-US", startOpts);
      this.sessionActive = true;
    } catch {
      // If start fails (e.g. mic in use by another app), back off and retry
      this.sessionActive = false;
      if (this.running) {
        this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
        this.scheduleRestart(this.backoffMs);
      }
    }
  }

  private fireDetection() {
    const now = Date.now();
    if (now - this.lastFiredAt < DEBOUNCE_MS) return;
    this.lastFiredAt = now;

    // Stop the current session immediately so command capture can use the mic
    this.sessionActive = false;
    this.Voice?.stop().catch(() => {});

    this.opts.onDetected();

    // After detection the orchestrator will call stop()/start() as needed
    // but schedule a fallback restart in case nothing calls back within 10 s
    this.scheduleRestart(10_000);
  }

  private async configureAudioSession() {
    try {
      const { Audio } = await import("expo-av");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        // Stay active so the mic works with screen off
        staysActiveInBackground: true,
        interruptionModeIOS: 1,    // DO_NOT_MIX
        interruptionModeAndroid: 1,
        shouldDuckAndroid: false,
      });
    } catch {
      // expo-av unavailable — continue without audio session config
    }
  }

  async stop() {
    this.running = false;
    this.sessionActive = false;
    if (this.restartHandle) {
      clearTimeout(this.restartHandle);
      this.restartHandle = null;
    }
    try {
      await this.Voice?.destroy();
    } catch { /* ignore */ }
    this.Voice = null;
  }
}

// ─── Public WakeWordEngine ────────────────────────────────────────────────────

export class WakeWordEngine {
  private nativeListener: { remove: () => void } | null = null;
  private webBackend:  WebSpeechBackend  | null = null;
  private pollBackend: VoicePollBackend  | null = null;
  private active = false;

  constructor(private opts: WakeWordEngineOptions) {}

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;

    // ── Web ──────────────────────────────────────────────────────────────────
    if (Platform.OS === "web") {
      this.webBackend = new WebSpeechBackend(this.opts);
      this.webBackend.start();
      return;
    }

    // ── Native: try NitroWakeWord first ──────────────────────────────────────
    if (NitroWakeWord) {
      try {
        await NitroWakeWord.start({
          sensitivity: this.opts.sensitivity ?? 0.5,
          keywords: WAKE_WORD_VARIANTS,
        });
        this.nativeListener = NitroWakeWord.addListener("onKeyword", this.opts.onDetected);
        console.log("[ADAMS] WakeWord: using NitroWakeWord (native)");
        return;
      } catch (err) {
        console.warn("[ADAMS] NitroWakeWord unavailable, falling back:", err);
        NitroWakeWord = null; // don't try again
      }
    }

    // ── Native: VoicePoll software fallback ───────────────────────────────────
    console.log("[ADAMS] WakeWord: using VoicePoll software backend");
    this.pollBackend = new VoicePollBackend(this.opts);
    await this.pollBackend.start();
  }

  async stop(): Promise<void> {
    if (!this.active) return;
    this.active = false;

    this.nativeListener?.remove();
    this.nativeListener = null;
    try { await NitroWakeWord?.stop(); } catch { /* ignore */ }

    this.webBackend?.stop();
    this.webBackend = null;

    await this.pollBackend?.stop();
    this.pollBackend = null;
  }

  get isActive(): boolean {
    return this.active;
  }
}
