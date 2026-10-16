/**
 * ADAMS Torch Module — JS entry point
 *
 * Wraps the native TorchModule on iOS/Android.
 * Falls back gracefully on web.
 */

import { Platform } from "react-native";

let _native: {
  setTorchEnabled: (on: boolean) => Promise<void>;
  isTorchAvailable: () => Promise<boolean>;
} | null = null;

function getNative() {
  if (_native) return _native;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _native = require("./src/TorchModule").TorchModule;
  } catch {
    _native = null;
  }
  return _native;
}

export async function setTorchEnabled(on: boolean): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const mod = getNative();
  if (!mod) return false;
  try {
    await mod.setTorchEnabled(on);
    return true;
  } catch {
    return false;
  }
}

export async function isTorchAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const mod = getNative();
  if (!mod) return false;
  try {
    return await mod.isTorchAvailable();
  } catch {
    return false;
  }
}
