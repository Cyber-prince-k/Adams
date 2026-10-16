/**
 * TorchModule — Expo Module JS binding
 * The native side is in ios/TorchModule.swift and android/TorchModule.kt
 */
import { requireNativeModule } from "expo-modules-core";

// requireNativeModule throws if the native module is not linked.
// We catch that in the index.ts wrapper.
export const TorchModule = requireNativeModule("AdamsTorch");
