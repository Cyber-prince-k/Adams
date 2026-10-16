/**
 * VoiceCapture
 *
 * After the wake word fires, this module switches the microphone into
 * command-capture mode using @react-native-voice/voice (native) or the
 * browser SpeechRecognition API (web).
 *
 * It emits:
 *   onPartial(text)   – interim transcript updates (live feedback)
 *   onFinal(text)     – final transcript ready for parsing/LLM
 *   onError(err)      – something went wrong
 *   onTimeout()       – no speech detected within VOICE_TIMEOUT_MS
 */

import { Platform } from "react-native";
import { VOICE_TIMEOUT_MS, VOICE_MAX_DURATION_MS } from "../../constants";

export interface CapturCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (err: Error) => void;
  onTimeout: () => void;
}

// ─── Web backend ──────────────────────────────────────────────────────────────

class WebCaptureBackend {
  private recognition: SpeechRecognition | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private maxHandle: ReturnType<typeof setTimeout> | null = null;
  private callbacks: CapturCallbacks;
  private lastPartial = "";

  constructor(callbacks: CapturCallbacks) {
    this.callbacks = callbacks;
  }

  start() {
    const SpeechRecognition =
      (window as typeof window & {
        SpeechRecognition?: typeof window.SpeechRecognition;
        webkitSpeechRecognition?: typeof window.SpeechRecognition;
      }).SpeechRecognition ||
      (window as typeof window & {
        webkitSpeechRecognition?: typeof window.SpeechRecognition;
      }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.callbacks.onError(new Error("Speech recognition not available"));
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.resetTimeout();
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t;
        } else {
          interim += t;
        }
      }

      if (interim) {
        this.lastPartial = interim;
        this.callbacks.onPartial(interim);
      }

      if (finalText) {
        this.clearTimers();
        this.callbacks.onFinal(finalText.trim());
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.clearTimers();
      if (event.error === "no-speech") {
        this.callbacks.onTimeout();
      } else {
        this.callbacks.onError(new Error(`Speech error: ${event.error}`));
      }
    };

    this.recognition.onend = () => {
      // If we ended without a final result, deliver last partial
      if (this.lastPartial) {
        this.clearTimers();
        this.callbacks.onFinal(this.lastPartial.trim());
      }
    };

    this.recognition.start();
    this.startTimeout();
    this.maxHandle = setTimeout(() => this.stop(), VOICE_MAX_DURATION_MS);
  }

  stop() {
    this.clearTimers();
    try {
      this.recognition?.stop();
    } catch {
      // ignore
    }
    this.recognition = null;
  }

  private resetTimeout() {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.timeoutHandle = setTimeout(() => {
      this.stop();
      this.callbacks.onTimeout();
    }, VOICE_TIMEOUT_MS);
  }

  private startTimeout() {
    this.timeoutHandle = setTimeout(() => {
      this.stop();
      this.callbacks.onTimeout();
    }, VOICE_TIMEOUT_MS);
  }

  private clearTimers() {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    if (this.maxHandle) clearTimeout(this.maxHandle);
    this.timeoutHandle = null;
    this.maxHandle = null;
  }
}

// ─── Native backend ───────────────────────────────────────────────────────────

class NativeCaptureBackend {
  private callbacks: CapturCallbacks;
  private Voice: typeof import("@react-native-voice/voice").default | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private maxHandle: ReturnType<typeof setTimeout> | null = null;
  private lastPartial = "";

  constructor(callbacks: CapturCallbacks) {
    this.callbacks = callbacks;
  }

  async start() {
    try {
      this.Voice = (await import("@react-native-voice/voice")).default;
    } catch {
      this.callbacks.onError(new Error("Voice module not available"));
      return;
    }

    // Tear down any prior session
    await this.Voice.destroy();

    this.Voice.onSpeechPartialResults = (e) => {
      const text = e.value?.[0] ?? "";
      this.lastPartial = text;
      this.callbacks.onPartial(text);
      this.resetTimeout();
    };

    this.Voice.onSpeechResults = (e) => {
      const text = e.value?.[0] ?? this.lastPartial;
      this.clearTimers();
      if (text) this.callbacks.onFinal(text.trim());
    };

    this.Voice.onSpeechError = (e) => {
      this.clearTimers();
      const code = (e.error as { code?: string })?.code ?? "unknown";
      if (code === "7" /* no match */ || code === "6" /* no speech */) {
        if (this.lastPartial) {
          this.callbacks.onFinal(this.lastPartial.trim());
        } else {
          this.callbacks.onTimeout();
        }
      } else {
        this.callbacks.onError(new Error(`Voice error ${code}`));
      }
    };

    this.Voice.onSpeechEnd = () => {
      this.clearTimers();
      if (this.lastPartial) {
        this.callbacks.onFinal(this.lastPartial.trim());
      }
    };

    // Android options use Google recognizer extras.
    // iOS uses SFSpeechRecognizer and silently ignores unknown keys on some
    // versions but can throw on others — pass only locale on iOS.
    const voiceOptions =
      Platform.OS === "android"
        ? { RECOGNIZER_ENGINE: "GOOGLE", EXTRA_PARTIAL_RESULTS: true }
        : {};

    try {
      await this.Voice.start("en-US", voiceOptions);
    } catch (err) {
      this.callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    this.startTimeout();
    this.maxHandle = setTimeout(() => this.stop(), VOICE_MAX_DURATION_MS);
  }

  async stop() {
    this.clearTimers();
    try {
      await this.Voice?.stop();
    } catch {
      // ignore
    }
    this.Voice = null;
  }

  private resetTimeout() {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.timeoutHandle = setTimeout(() => {
      this.stop();
      if (this.lastPartial) {
        this.callbacks.onFinal(this.lastPartial.trim());
      } else {
        this.callbacks.onTimeout();
      }
    }, VOICE_TIMEOUT_MS);
  }

  private startTimeout() {
    this.timeoutHandle = setTimeout(() => {
      this.stop();
      this.callbacks.onTimeout();
    }, VOICE_TIMEOUT_MS);
  }

  private clearTimers() {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    if (this.maxHandle) clearTimeout(this.maxHandle);
    this.timeoutHandle = null;
    this.maxHandle = null;
  }
}

// ─── Public VoiceCapture class ────────────────────────────────────────────────

export class VoiceCapture {
  private webBackend: WebCaptureBackend | null = null;
  private nativeBackend: NativeCaptureBackend | null = null;
  private capturing = false;

  async start(callbacks: CapturCallbacks): Promise<void> {
    if (this.capturing) await this.stop();
    this.capturing = true;

    if (Platform.OS === "web") {
      this.webBackend = new WebCaptureBackend(callbacks);
      this.webBackend.start();
    } else {
      this.nativeBackend = new NativeCaptureBackend(callbacks);
      await this.nativeBackend.start();
    }
  }

  async stop(): Promise<void> {
    this.capturing = false;
    this.webBackend?.stop();
    this.webBackend = null;
    await this.nativeBackend?.stop();
    this.nativeBackend = null;
  }

  get isCapturing(): boolean {
    return this.capturing;
  }
}

export const voiceCapture = new VoiceCapture();
