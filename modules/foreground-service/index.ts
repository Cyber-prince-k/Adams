/**
 * ADAMS Foreground Service — JS entry point
 *
 * Android only. No-op on iOS and web (iOS background audio mode
 * is configured through app.json UIBackgroundModes instead).
 */

import { Platform } from "react-native";

let _native: {
  start: (options?: { title?: string; text?: string }) => Promise<void>;
  stop: () => Promise<void>;
  updateNotification: (options: { title: string; text: string }) => Promise<void>;
} | null = null;

function getNative() {
  if (_native) return _native;
  try {
    const { requireNativeModule } = require("expo-modules-core");
    _native = requireNativeModule("AdamsForegroundService");
  } catch {
    _native = null;
  }
  return _native;
}

export interface ForegroundServiceOptions {
  title?: string;
  text?: string;
}

/**
 * Start the foreground service with a persistent notification.
 * Required on Android 12+ for background microphone access.
 */
export async function startForegroundService(
  options: ForegroundServiceOptions = {}
): Promise<void> {
  if (Platform.OS !== "android") return;
  const mod = getNative();
  if (!mod) {
    console.warn("[ADAMS] Foreground service module not available — run a custom dev build");
    return;
  }
  await mod.start({
    title: options.title ?? "ADAMS is listening",
    text:  options.text  ?? 'Say "Hey Adams" to give a command',
  });
}

/**
 * Stop the foreground service and remove the notification.
 */
export async function stopForegroundService(): Promise<void> {
  if (Platform.OS !== "android") return;
  const mod = getNative();
  if (!mod) return;
  await mod.stop();
}

/**
 * Update the notification text while the service is running
 * (e.g. change from "Listening…" to "Captured!" without restarting).
 */
export async function updateForegroundNotification(
  options: Required<ForegroundServiceOptions>
): Promise<void> {
  if (Platform.OS !== "android") return;
  const mod = getNative();
  if (!mod) return;
  await mod.updateNotification(options);
}
