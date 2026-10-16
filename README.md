# ADAMS
### Adaptive Digital Assistant & Management System

A JARVIS-style hybrid voice assistant built with **React Native + Expo**. Always listening, always responsive — on-device for instant private commands, cloud-connected for anything requiring intelligence.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        ADAMS                            │
│                                                         │
│   ┌──────────────┐          ┌────────────────────────┐  │
│   │  TIER 1      │          │  TIER 2                │  │
│   │  On-Device   │ escalate │  Cloud Chat            │  │
│   │              │ ───────► │                        │  │
│   │ Wake Word    │          │ OpenAI / DeepSeek /    │  │
│   │ (Nitro)      │          │ Ollama via SSE stream  │  │
│   │    │         │          │                        │  │
│   │    ▼         │          │ Convex sync (optional) │  │
│   │ Voice        │          │                        │  │
│   │ Capture      │          │ iOS + Android + Web    │  │
│   │    │         │          │ unified codebase       │  │
│   │    ▼         │          └────────────────────────┘  │
│   │ Local        │                                       │
│   │ Parser       │                                       │
│   │    │         │                                       │
│   │  ┌─┴──────┐  │                                       │
│   │  │execute │  │                                       │
│   │  │natively│  │                                       │
│   │  └────────┘  │                                       │
│   └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

### Two-tier design

| Tier | What it handles | Latency | Privacy |
|------|----------------|---------|---------|
| On-device | Flashlight, calls, music, app launch, timers | < 100 ms | 100% on-device |
| Cloud chat | Reasoning, knowledge, conversation | 500 ms–2 s | API key required |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
# or
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set your OPENAI_API_KEY (or DEEPSEEK_API_KEY / OLLAMA_BASE_URL)
```

### 3. Run

```bash
# Start dev server
npx expo start

# iOS simulator
npx expo run:ios

# Android emulator
npx expo run:android

# Web browser
npx expo start --web
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `OLLAMA_BASE_URL` | Ollama base URL (default: `http://localhost:11434`) |
| `EXPO_PUBLIC_LLM_PROVIDER` | `openai` \| `deepseek` \| `ollama` |
| `EXPO_PUBLIC_LLM_MODEL` | Model name (e.g. `gpt-4o-mini`) |
| `EXPO_PUBLIC_CONVEX_URL` | Convex deployment URL (optional) |
| `EXPO_PUBLIC_MOCK_AI` | Set `1` for mock streaming (no API key needed) |
| `EXPO_PUBLIC_WAKE_WORD_SENSITIVITY` | `0.0`–`1.0` (default `0.5`) |

---

## Project Structure

```
adams/
├── app/                    Expo Router screens
│   ├── _layout.tsx         Root navigator
│   ├── index.tsx           Voice home screen
│   ├── chat.tsx            Chat interface
│   ├── settings.tsx        Provider & model settings
│   └── api/
│       └── chat+api.ts     Server-side LLM proxy (web)
├── src/
│   ├── modules/
│   │   ├── wakeword/       WakeWordEngine + WakeWordService
│   │   ├── voice/          VoiceCapture + VoiceOrchestrator
│   │   ├── parser/         LocalCommandParser + LocalCommandExecutor
│   │   ├── llm/            LLMClient + useStreamingChat
│   │   └── sync/           ConversationSync (Convex)
│   ├── components/
│   │   ├── ListeningIndicator.tsx
│   │   ├── PrivacyToggle.tsx
│   │   └── chat/
│   │       ├── MessageBubble.tsx
│   │       ├── ChatInput.tsx
│   │       └── MarkdownRenderer.tsx
│   ├── constants/          App-wide constants
│   ├── types/              Shared TypeScript types
│   └── utils/              nanoid, helpers
├── convex/                 Convex backend (optional sync)
│   ├── schema.ts
│   └── messages.ts
├── global.css              Tailwind v4 + ADAMS design tokens
└── app.json                Expo config (permissions, plugins)
```

---

## Local Commands (on-device, no internet)

| Phrase | Action |
|--------|--------|
| "Turn on the flashlight" | Toggle torch |
| "Call Mom" | Open native dialer |
| "Play jazz on Spotify" | Open Spotify search |
| "Open Settings" | Launch system settings |
| "Set a timer for 5 minutes" | Open clock/timer |
| "Set an alarm for 7am" | Open clock/alarm |

---

## Optional: Convex Cross-Device Sync

```bash
# Connect your project to Convex
npx convex dev

# Deploy schema + functions
npx convex deploy
```

Set `EXPO_PUBLIC_CONVEX_URL` in `.env` to your deployment URL.

---

## Platform Notes

### iOS
- Background microphone requires the `audio` UIBackgroundMode (already set in `app.json`)
- `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription` are pre-configured

### Android
- A foreground service notification is shown while wake word is active (required by Android 12+)
- `FOREGROUND_SERVICE_MICROPHONE` permission is declared in `app.json`

### Web
- Wake word uses the browser's `SpeechRecognition` API (Chrome/Edge; Firefox requires a flag)
- No native permissions needed on web — browser will prompt on first use

---

## License

MIT
