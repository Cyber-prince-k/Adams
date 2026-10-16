# ADAMS — Custom Dev Build Guide

This guide gets you from zero to a fully native ADAMS build running on your
physical device. A **custom dev build** is required for:

| Feature | Why Expo Go can't do it |
|---|---|
| Flashlight / torch | Custom `AdamsTorch` native module (AVCaptureDevice / CameraManager) |
| Background wake word | Android foreground service + iOS background audio mode |
| `@react-native-voice/voice` | Native module not bundled in Expo Go |
| `expo-background-fetch` | Background task scheduling requires native linkage |

The custom build is essentially your own version of Expo Go compiled with all
your native modules included. You run it once, then iterate on JS code without
rebuilding.

---

## Prerequisites

### Everyone

```powershell
# 1. Node.js 18+ (LTS recommended)
#    Download from https://nodejs.org

# 2. Expo CLI
npm install -g expo-cli eas-cli

# 3. Install project dependencies
cd C:\Users\ICT\Music\adams
npm install
```

### For Android builds

| Tool | Install |
|---|---|
| Java 17 (JDK) | https://adoptium.net — download Temurin 17 |
| Android Studio | https://developer.android.com/studio |
| Android SDK 34 | Open Android Studio → SDK Manager → SDK Platforms → Android 14 |
| Android NDK 26 | SDK Manager → SDK Tools → NDK (Side by side) → 26.x |
| USB Debugging | Phone → Settings → About → tap Build Number 7× → Developer Options → USB Debugging ON |

Set these environment variables (add to your PowerShell profile or System env):
```powershell
$env:JAVA_HOME  = "C:\Program Files\Eclipse Adoptium\jdk-17.x.x.x-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path += ";$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator"
```

### For iOS builds (Mac only)

| Tool | Install |
|---|---|
| macOS 13+ | Required |
| Xcode 15+ | App Store |
| Xcode Command Line Tools | `xcode-select --install` |
| CocoaPods | `sudo gem install cocoapods` |
| Apple Developer Account | https://developer.apple.com (free for device testing) |

> **Windows users:** You cannot build iOS natively on Windows.
> Use **EAS Build** (cloud build) instead — see the [Cloud Build](#option-b-eas-cloud-build) section.

---

## Step 1 — Environment file

```powershell
copy .env.example .env
```

Open `.env` and fill in at minimum:

```env
EXPO_PUBLIC_MOCK_AI=1          # use mock responses while setting up
EXPO_PUBLIC_LLM_PROVIDER=openai
EXPO_PUBLIC_LLM_MODEL=gpt-4o-mini
```

You can add your real `OPENAI_API_KEY` later once the build is working.

---

## Step 2 — Generate native projects (prebuild)

`expo prebuild` generates the `android/` and `ios/` folders and runs all
Config Plugins (including the torch module and foreground service manifest
injection).

```powershell
# Clean prebuild (recommended first time)
npx expo prebuild --clean
```

This will:
- Create `android/` and `ios/` native project folders
- Run `withAndroidForegroundService` → injects service + permissions into `AndroidManifest.xml`
- Register the `AdamsTorch` and `AdamsForegroundService` Expo Modules via autolinking
- Run `pod install` on iOS (Mac only)

> **Do not edit** the generated `android/` and `ios/` folders manually.
> They are regenerated on every `expo prebuild`. Put all native customisations
> inside the `modules/` folder as Expo Modules or Config Plugins.

---

## Option A — Local Build (compile on your own machine)

### Android

```powershell
# Connect phone via USB (USB Debugging on), then:
npx expo run:android

# Or build a debug APK file you can sideload:
npx expo run:android --variant debug
# APK will be at: android/app/build/outputs/apk/debug/app-debug.apk
```

The build takes 3–8 minutes the first time (Gradle downloads dependencies).
Subsequent builds are incremental and take ~30 seconds.

**To install the APK manually on your phone:**
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

### iOS (Mac only)

```powershell
# Open in Xcode and run on connected device:
npx expo run:ios --device

# Or build for simulator:
npx expo run:ios
```

On first run Xcode will ask you to select a Development Team. Sign in with
your Apple ID (free accounts work for device testing, 7-day certificate).

---

## Option B — EAS Cloud Build (works on Windows for iOS)

EAS Build compiles your app in Expo's cloud infrastructure. You get a
`.apk` / `.ipa` file back that you install on your device.

### Setup (one-time)

```powershell
# Log in to Expo account (create one free at expo.dev)
eas login

# Link the project to your Expo account
eas init --id YOUR_PROJECT_ID
```

### Build

```powershell
# Android — development build (APK, installs directly on device)
eas build --profile development --platform android

# iOS — development build (requires Apple Developer account)
eas build --profile development --platform ios

# Both platforms simultaneously
eas build --profile development --platform all
```

EAS will give you a download link when the build finishes (~5–10 min).

**Install the APK on Android:**
1. Download the `.apk` from the EAS dashboard link
2. Transfer to phone (USB / Google Drive / email)
3. Open the `.apk` on the phone — Android will prompt you to allow
   "Install from unknown sources" — allow it

**Install the IPA on iOS:**
1. Download from the EAS dashboard
2. Use [Apple Configurator 2](https://apps.apple.com/app/apple-configurator-2/id1037126344)
   on a Mac, or register the device UDID in your Apple Developer account and
   use EAS Submit

---

## Step 3 — Start the dev server

After the app is installed on your device, start the Metro bundler:

```powershell
cd C:\Users\ICT\Music\adams
npx expo start --dev-client
```

Open the **ADAMS** app on your phone (not Expo Go — the custom build you just
installed). It will connect to your dev server automatically if you're on the
same Wi-Fi. You'll see a QR code — scan it with the ADAMS app if it doesn't
auto-connect.

> **Tip:** If your phone can't reach your PC's IP address (common on corporate
> or guest Wi-Fi), press `t` in the terminal to enable tunnel mode:
> ```powershell
> npx expo start --dev-client --tunnel
> ```

---

## Step 4 — Grant permissions

On first launch the app will request:

| Permission | Required for |
|---|---|
| Microphone | Wake word detection + voice commands |
| Speech Recognition (iOS) | `@react-native-voice/voice` |
| Camera (optional) | Flashlight / torch |

**Android:** You'll also see the persistent "ADAMS is listening" notification —
this is required by Android 12+ to keep the microphone active in the background.
You can tap "Stop listening" in the notification or use the toggle in the app.

---

## Step 5 — Enable real AI responses

Once the build is working, edit `.env`:

```env
EXPO_PUBLIC_MOCK_AI=0
OPENAI_API_KEY=sk-...          # your real key
```

Restart the dev server (`Ctrl+C` then `npx expo start --dev-client`).
No rebuild needed — environment variables are picked up by Metro at bundle time.

---

## Project structure reminder

```
adams/
├── modules/
│   ├── torch/
│   │   ├── ios/TorchModule.swift          ← AVCaptureDevice torch
│   │   ├── android/TorchModule.kt         ← CameraManager torch
│   │   └── expo-module.config.json
│   └── foreground-service/
│       ├── android/AdamsListeningService.kt   ← START_STICKY foreground svc
│       ├── android/ForegroundServiceModule.kt ← Expo Module JS bridge
│       ├── plugin/withAndroidForegroundService.js  ← Config Plugin
│       └── expo-module.config.json
├── android/                               ← generated by expo prebuild (don't edit)
├── ios/                                   ← generated by expo prebuild (don't edit)
├── app/                                   ← Expo Router screens
├── src/                                   ← all TypeScript source
├── eas.json                               ← EAS build profiles
└── app.json                               ← Expo config + plugins
```

---

## Troubleshooting

### "Unable to resolve module" errors on start
```powershell
# Clear Metro cache
npx expo start --dev-client --clear
```

### Android build fails with Gradle errors
```powershell
# Clean Gradle cache
cd android
.\gradlew clean
cd ..
npx expo run:android
```

### iOS CocoaPods errors (Mac)
```powershell
cd ios
pod deintegrate
pod install
cd ..
npx expo run:ios
```

### Wake word not firing in background (Android)
- Check that the "ADAMS is listening" notification is visible in the notification shade
- Go to **Settings → Apps → ADAMS → Battery** → set to "Unrestricted"
- Disable battery optimisation for ADAMS in **Settings → Battery → Battery Optimisation**

### Wake word not firing in background (iOS)
- Go to **Settings → ADAMS → Background App Refresh** → ON
- Settings → Privacy & Security → Microphone → ADAMS → ON
- The app must have been opened at least once after install

### Torch not working
- Ensure Camera permission is granted: **Settings → ADAMS → Camera → ON**
- The `AdamsTorch` module requires a custom build — it won't work in Expo Go

---

## Feature availability matrix

| Feature | Expo Go | Custom Dev Build | Production Build |
|---|:---:|:---:|:---:|
| Chat UI | ✅ | ✅ | ✅ |
| LLM streaming | ✅ | ✅ | ✅ |
| Voice commands (tap) | ✅ | ✅ | ✅ |
| Wake word (foreground) | ⚠️ partial | ✅ | ✅ |
| Wake word (background) | ❌ | ✅ | ✅ |
| Flashlight / torch | ❌ | ✅ | ✅ |
| Phone calls | ✅ | ✅ | ✅ |
| Open apps / music | ✅ | ✅ | ✅ |
| Foreground service notification | ❌ | ✅ | ✅ |
| Convex cross-device sync | ✅ | ✅ | ✅ |
