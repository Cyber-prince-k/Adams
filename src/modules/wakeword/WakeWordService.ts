/**
 * WakeWordService
 *
 * Singleton that manages the full wake-word lifecycle:
 *   1. Starts/stops WakeWordEngine
 *   2. Runs the Android foreground service (required for bg microphone on API 31+)
 *   3. Registers iOS / Android background-fetch keepalive
 *   4. Watches AppState to resume on foreground
 *   5. Notifies subscribers on detection
 *
 * All heavy native modules are lazy-loaded so the module is safe in Expo Go
 * (where background-fetch and the foreground service won't be available).
 */

import { Platform, AppState, type AppStateStatus } from "react-native";
import { BACKGROUND_FETCH_TASK_ID } from "../../constants";
import { WakeWordEngine } from "./WakeWordEngine";
import {
  startForegroundService,
  stopForegroundService,
  updateForegroundNotification,
} from "../../../modules/foreground-service/index";

// ── Background fetch helpers (lazy, not available in Expo Go) ─────────────────

async function tryRegisterBackground(): Promise<void> {
  try {
    const TaskManager    = await import("expo-task-manager");
    const BackgroundFetch = await import("expo-background-fetch");

    if (!TaskManager.isTaskDefined(BACKGROUND_FETCH_TASK_ID)) {
      TaskManager.defineTask(BACKGROUND_FETCH_TASK_ID, async () => {
        return BackgroundFetch.BackgroundFetchResult.NewData;
      });
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK_ID, {
      minimumInterval: 60,      // iOS minimum
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    /* Expo Go or already registered — not fatal */
  }
}

async function tryUnregisterBackground(): Promise<void> {
  try {
    const BackgroundFetch = await import("expo-background-fetch");
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK_ID);
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────────────────────

type WakeWordListener = () => void;

class WakeWordServiceClass {
  private engine: WakeWordEngine | null = null;
  private listeners = new Set<WakeWordListener>();
  private enabled = true;
  private appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async initialize(opts?: { sensitivity?: number }): Promise<void> {
    if (this.engine) return; // already running

    this.engine = new WakeWordEngine({
      sensitivity: opts?.sensitivity ?? 0.5,
      onDetected: () => this.handleDetection(),
      onError:    (err) => console.warn("[ADAMS WakeWord]", err.message),
    });

    if (this.enabled) {
      await this.engine.start();
      await this.startNativeServices();
    }

    this.watchAppState();
  }

  async destroy(): Promise<void> {
    this.appStateSub?.remove();
    this.appStateSub = null;

    await this.engine?.stop();
    this.engine = null;

    await this.stopNativeServices();
  }

  // ── Enable / Disable ───────────────────────────────────────────────────────

  async enable(): Promise<void> {
    this.enabled = true;
    if (this.engine && !this.engine.isActive) {
      await this.engine.start();
      await this.startNativeServices();
    }
  }

  async disable(): Promise<void> {
    this.enabled = false;
    if (this.engine?.isActive) {
      await this.engine.stop();
    }
    await this.stopNativeServices();
  }

  /** Update the Android notification text (e.g. when state changes) */
  async setNotificationText(title: string, text: string): Promise<void> {
    await updateForegroundNotification({ title, text }).catch(() => {});
  }

  get isEnabled(): boolean { return this.enabled; }
  get isListening(): boolean { return this.engine?.isActive ?? false; }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  onDetected(cb: WakeWordListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private handleDetection(): void {
    this.listeners.forEach((cb) => cb());
  }

  private async startNativeServices(): Promise<void> {
    // Android: foreground service keeps mic alive in background
    if (Platform.OS === "android") {
      await startForegroundService({
        title: "ADAMS is listening",
        text: 'Say "Hey Adams" to give a command',
      }).catch((e) => console.warn("[ADAMS] Foreground service start:", e));
    }

    // iOS / Android: background-fetch keepalive
    await tryRegisterBackground();
  }

  private async stopNativeServices(): Promise<void> {
    if (Platform.OS === "android") {
      await stopForegroundService().catch(() => {});
    }
    await tryUnregisterBackground();
  }

  private watchAppState(): void {
    this.appStateSub = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (!this.enabled) return;
        if (state === "active" && this.engine && !this.engine.isActive) {
          this.engine.start().catch(console.warn);
        }
      }
    );
  }
}

export const WakeWordService = new WakeWordServiceClass();
