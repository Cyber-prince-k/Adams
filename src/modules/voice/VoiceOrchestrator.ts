/**
 * VoiceOrchestrator
 *
 * The central state machine that ties together:
 *   WakeWordService → VoiceCapture → LocalCommandParser → (execute | escalate to chat)
 *
 * States:
 *   idle      → engine disabled
 *   standby   → wake word engine listening
 *   triggered → wake word heard, preparing capture
 *   capturing → mic open, collecting speech
 *   processing → parsing / executing
 *   error     → recoverable error
 */

import { type ListeningState } from "../../types";
import { WakeWordService } from "../wakeword/WakeWordService";
import { voiceCapture } from "./VoiceCapture";
import { commandParser } from "../parser/LocalCommandParser";
import { commandExecutor } from "../parser/LocalCommandExecutor";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export interface OrchestratorCallbacks {
  onStateChange: (state: ListeningState) => void;
  onPartialTranscript: (text: string) => void;
  onLocalFeedback: (feedback: string) => void;
  onEscalateToChat: (transcript: string) => void;
  onError: (msg: string) => void;
}

class VoiceOrchestratorClass {
  private callbacks: OrchestratorCallbacks | null = null;
  private state: ListeningState = "idle";
  private wakeUnsubscribe: (() => void) | null = null;
  private sensitivity = 0.5;

  // ── Setup / teardown ───────────────────────────────────────────────────────

  async init(callbacks: OrchestratorCallbacks, sensitivity?: number): Promise<void> {
    this.callbacks = callbacks;
    this.sensitivity = sensitivity ?? 0.5;

    await WakeWordService.initialize({ sensitivity: this.sensitivity });
    this.wakeUnsubscribe = WakeWordService.onDetected(() => this.handleWakeWord());
    this.setState("standby");
  }

  async destroy(): Promise<void> {
    this.wakeUnsubscribe?.();
    this.wakeUnsubscribe = null;
    await WakeWordService.destroy();
    await voiceCapture.stop();
    this.setState("idle");
    this.callbacks = null;
  }

  // ── Enable / disable toggle ────────────────────────────────────────────────

  async enable(): Promise<void> {
    await WakeWordService.enable();
    this.setState("standby");
  }

  async disable(): Promise<void> {
    await WakeWordService.disable();
    await voiceCapture.stop();
    this.setState("idle");
  }

  get currentState(): ListeningState {
    return this.state;
  }

  /** Allow the UI to manually trigger the wake-word flow (mic tap button). */
  async triggerManually(): Promise<void> {
    if (this.state === "standby" || this.state === "idle") {
      await this.handleWakeWord();
    }
  }

  // ── Wake word detected ─────────────────────────────────────────────────────

  private async handleWakeWord(): Promise<void> {
    if (this.state !== "standby") return;

    this.setState("triggered");
    this.haptic("medium");

    // Update Android notification so user knows wake word was heard
    WakeWordService.setNotificationText("ADAMS heard you", "Processing your command…");

    await sleep(350);
    await this.startCapture();
  }

  // ── Voice capture ──────────────────────────────────────────────────────────

  private async startCapture(): Promise<void> {
    this.setState("capturing");

    await voiceCapture.start({
      onPartial: (text) => {
        this.callbacks?.onPartialTranscript(text);
      },

      onFinal: (text) => {
        this.handleTranscript(text);
      },

      onError: (err) => {
        console.warn("[ADAMS Orchestrator] capture error:", err.message);
        this.setState("error");
        this.callbacks?.onError(err.message);
        this.recoverToStandby();
      },

      onTimeout: () => {
        this.setState("standby");
      },
    });
  }

  // ── Transcript routing ─────────────────────────────────────────────────────

  private async handleTranscript(text: string): Promise<void> {
    if (!text.trim()) {
      this.setState("standby");
      return;
    }

    this.setState("processing");

    const parsed = commandParser.parse(text);

    if (parsed.isLocal) {
      const result = await commandExecutor.execute(parsed);
      this.callbacks?.onLocalFeedback(result.feedback);
      this.haptic("success");
      WakeWordService.setNotificationText("ADAMS is listening", 'Say "Hey Adams" to give a command');
      this.setState("standby");
    } else {
      this.haptic("light");
      WakeWordService.setNotificationText("ADAMS is listening", 'Say "Hey Adams" to give a command');
      this.callbacks?.onEscalateToChat(text);
      this.setState("standby");
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private setState(state: ListeningState) {
    this.state = state;
    this.callbacks?.onStateChange(state);
  }

  private recoverToStandby(delayMs = 2000) {
    setTimeout(() => {
      if (this.state === "error") this.setState("standby");
    }, delayMs);
  }

  private haptic(type: "light" | "medium" | "success") {
    if (Platform.OS === "web") return;
    switch (type) {
      case "light":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        break;
      case "medium":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        break;
      case "success":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        break;
    }
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const VoiceOrchestrator = new VoiceOrchestratorClass();
