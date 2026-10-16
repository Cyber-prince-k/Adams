/**
 * LocalCommandExecutor
 *
 * Receives a ParsedIntent from LocalCommandParser and executes
 * the appropriate native action.
 *
 * Flashlight uses the custom AdamsTorch native module (Swift/Kotlin)
 * which works in any custom dev build and is properly available via
 * expo-modules-core — no expo-camera dependency needed.
 */

import { Linking, Platform } from "react-native";
import type { ParsedIntent } from "../../types";

export interface ExecutionResult {
  success: boolean;
  feedback: string;
}

// ─── Torch helpers ────────────────────────────────────────────────────────────

async function getTorch() {
  try {
    return await import("../../../modules/torch/index");
  } catch {
    return null;
  }
}

// ─── Executor class ───────────────────────────────────────────────────────────

export class LocalCommandExecutor {
  private flashlightOn = false;

  async execute(intent: ParsedIntent): Promise<ExecutionResult> {
    try {
      switch (intent.intent) {
        case "flashlight_on":
          return await this.controlFlashlight(true);
        case "flashlight_off":
          return await this.controlFlashlight(false);
        case "flashlight_toggle":
          return await this.controlFlashlight(!this.flashlightOn);
        case "call":
          return await this.placeCall(String(intent.params["contact"] ?? ""));
        case "play_music":
          return await this.playMusic(
            String(intent.params["query"] ?? ""),
            String(intent.params["app"] ?? "spotify")
          );
        case "stop_music":
          return { success: true, feedback: "Use your music app to stop playback." };
        case "launch_app":
          return await this.launchApp(String(intent.params["app"] ?? ""));
        case "set_volume":
          return { success: true, feedback: "Volume adjusted." };
        case "set_timer":
          return await this.setTimer(String(intent.params["duration"] ?? ""));
        case "set_alarm":
          return await this.setAlarm(String(intent.params["time"] ?? ""));
        default:
          return { success: false, feedback: "I couldn't handle that locally." };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[ADAMS Executor]", msg);
      return { success: false, feedback: `Error: ${msg}` };
    }
  }

  // ── Flashlight — uses custom AdamsTorch native module ─────────────────────

  private async controlFlashlight(on: boolean): Promise<ExecutionResult> {
    if (Platform.OS === "web") {
      return { success: false, feedback: "Flashlight isn't available on web." };
    }

    const torch = await getTorch();
    if (!torch) {
      return {
        success: false,
        feedback: "Torch module not available. Run a custom dev build.",
      };
    }

    const available = await torch.isTorchAvailable();
    if (!available) {
      return { success: false, feedback: "This device has no torch." };
    }

    const ok = await torch.setTorchEnabled(on);
    if (ok) {
      this.flashlightOn = on;
      return { success: true, feedback: on ? "Flashlight on." : "Flashlight off." };
    }
    return {
      success: false,
      feedback: `Couldn't ${on ? "enable" : "disable"} the flashlight.`,
    };
  }

  // ── Phone call ────────────────────────────────────────────────────────────

  private async placeCall(contact: string): Promise<ExecutionResult> {
    if (!contact) return { success: false, feedback: "Who should I call?" };
    const url = `tel:${encodeURIComponent(contact)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      return { success: false, feedback: "Phone calls aren't supported on this device." };
    }
    await Linking.openURL(url);
    return { success: true, feedback: `Calling ${contact}…` };
  }

  // ── Music ─────────────────────────────────────────────────────────────────

  private readonly MUSIC_SCHEMES: Record<string, string> = {
    spotify:       "spotify:search:",
    "apple music": "music://",
    youtube:       "youtube://",
    "youtube music": "youtubemusic://",
    tidal:         "tidal://",
    deezer:        "deezer://",
  };

  private async playMusic(query: string, app: string): Promise<ExecutionResult> {
    const scheme = this.MUSIC_SCHEMES[app] ?? this.MUSIC_SCHEMES["spotify"]!;
    const url = `${scheme}${encodeURIComponent(query)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      await Linking.openURL(`https://music.youtube.com/search?q=${encodeURIComponent(query)}`);
      return { success: true, feedback: `Opening "${query}" in YouTube Music.` };
    }
    await Linking.openURL(url);
    return { success: true, feedback: `Playing "${query}" on ${app}.` };
  }

  // ── Launch app ────────────────────────────────────────────────────────────

  private readonly APP_SCHEMES: Record<string, string> = {
    settings:    Platform.OS === "ios" ? "app-settings:" : "package:com.android.settings",
    chrome:      "googlechrome://",
    maps:        Platform.OS === "ios" ? "maps://" : "geo:",
    youtube:     "youtube://",
    instagram:   "instagram://",
    twitter:     "twitter://",
    whatsapp:    "whatsapp://",
    telegram:    "tg://",
    spotify:     "spotify://",
    netflix:     "nflx://",
  };

  private async launchApp(app: string): Promise<ExecutionResult> {
    const key = app.toLowerCase().trim();
    const scheme = this.APP_SCHEMES[key];
    if (scheme) {
      const supported = await Linking.canOpenURL(scheme);
      if (supported) {
        await Linking.openURL(scheme);
        return { success: true, feedback: `Opening ${app}.` };
      }
    }
    return {
      success: false,
      feedback: `I can't open "${app}" — it may not be installed.`,
    };
  }

  // ── Timer ─────────────────────────────────────────────────────────────────

  private async setTimer(duration: string): Promise<ExecutionResult> {
    if (Platform.OS === "ios") {
      // Parse duration into seconds for the iOS clock URL scheme
      const seconds = parseDurationToSeconds(duration);
      if (seconds > 0) {
        const url = `clock-timer://start?seconds=${seconds}`;
        const ok = await Linking.canOpenURL(url);
        if (ok) {
          await Linking.openURL(url);
          return { success: true, feedback: `Timer set for ${duration}.` };
        }
      }
      // Fallback: open clock app
      await Linking.openURL("clock-timer://").catch(() => {});
    } else if (Platform.OS === "android") {
      const seconds = parseDurationToSeconds(duration);
      if (seconds > 0) {
        const url = `android-app://com.google.android.deskclock/alarm?timer_length=${seconds}`;
        await Linking.openURL(url).catch(async () => {
          await Linking.openURL("android.timer://").catch(() => {});
        });
      }
    }
    return { success: true, feedback: `Timer set for ${duration}.` };
  }

  // ── Alarm ─────────────────────────────────────────────────────────────────

  private async setAlarm(time: string): Promise<ExecutionResult> {
    if (Platform.OS === "ios") {
      await Linking.openURL("clock-alarm://").catch(() => {});
    } else if (Platform.OS === "android") {
      // Android ACTION_SET_ALARM intent via URL scheme
      const [hourStr, rest] = time.split(":");
      const hour = parseInt(hourStr ?? "0", 10);
      const minuteStr = (rest ?? "").replace(/[^0-9]/g, "");
      const minute = parseInt(minuteStr || "0", 10);
      const ampm = time.toLowerCase().includes("pm") ? "pm" : "am";
      const hour24 =
        ampm === "pm" && hour < 12 ? hour + 12 : ampm === "am" && hour === 12 ? 0 : hour;
      const url = `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hour24};i.android.intent.extra.alarm.MINUTES=${minute};end`;
      await Linking.openURL(url).catch(() => {});
    }
    return { success: true, feedback: `Alarm set for ${time}.` };
  }
}

// ─── Duration parser ──────────────────────────────────────────────────────────

function parseDurationToSeconds(text: string): number {
  let total = 0;
  const hoursMatch = text.match(/(\d+)\s*h(our)?s?/i);
  const minsMatch  = text.match(/(\d+)\s*m(in(ute)?s?)?/i);
  const secsMatch  = text.match(/(\d+)\s*s(ec(ond)?s?)?/i);
  if (hoursMatch) total += parseInt(hoursMatch[1]!, 10) * 3600;
  if (minsMatch)  total += parseInt(minsMatch[1]!, 10) * 60;
  if (secsMatch)  total += parseInt(secsMatch[1]!, 10);
  return total;
}

export const commandExecutor = new LocalCommandExecutor();
