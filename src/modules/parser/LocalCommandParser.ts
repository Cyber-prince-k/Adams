/**
 * LocalCommandParser
 *
 * Lightweight rule-based NLP that classifies a text utterance into either:
 *   • A local intent  → execute natively, no LLM needed
 *   • Unknown intent  → escalate to the cloud chat
 *
 * Design goals:
 *   • Zero network calls
 *   • < 2 ms on a mid-range phone
 *   • Easy to extend with new rules
 */

import type { ParsedIntent, LocalIntentType } from "../../types";

// ─── Rule definition ─────────────────────────────────────────────────────────

interface Rule {
  intent: LocalIntentType;
  patterns: RegExp[];
  extract?: (match: RegExpMatchArray, raw: string) => Record<string, string | number | boolean>;
  confidence: number;
}

// ─── Rules ───────────────────────────────────────────────────────────────────

const RULES: Rule[] = [
  // Flashlight ON
  {
    intent: "flashlight_on",
    patterns: [
      /\b(turn|switch|put)?\s*(on|enable)\s*(the\s+)?flashlight\b/i,
      /\bflashlight\s+(on|enable)\b/i,
      /\btorch\s+on\b/i,
      /\bturn on (the )?torch\b/i,
    ],
    confidence: 0.95,
  },
  // Flashlight OFF
  {
    intent: "flashlight_off",
    patterns: [
      /\b(turn|switch|put)?\s*(off|disable)\s*(the\s+)?flashlight\b/i,
      /\bflashlight\s+(off|disable)\b/i,
      /\btorch\s+off\b/i,
      /\bturn off (the )?torch\b/i,
    ],
    confidence: 0.95,
  },
  // Flashlight toggle
  {
    intent: "flashlight_toggle",
    patterns: [/\btoggle\s+(the\s+)?(flashlight|torch)\b/i, /\bflashlight\b/i],
    confidence: 0.7,
  },
  // Phone call
  {
    intent: "call",
    patterns: [
      /\bcall\s+(?<contact>.+)/i,
      /\bphone\s+(?<contact>.+)/i,
      /\bdial\s+(?<contact>.+)/i,
      /\bring\s+(?<contact>.+)/i,
    ],
    extract: (match) => ({
      contact: (match.groups?.["contact"] ?? "").trim(),
    }),
    confidence: 0.9,
  },
  // Play music
  {
    intent: "play_music",
    patterns: [
      /\bplay\s+(?<query>.+?)(\s+on\s+(?<app>spotify|apple music|youtube music|tidal|deezer))?\s*$/i,
      /\bput on\s+(?<query>.+)/i,
      /\bstart\s+(playing\s+)?(?<query>.+)/i,
    ],
    extract: (match) => ({
      query: (match.groups?.["query"] ?? "").trim(),
      app: (match.groups?.["app"] ?? "spotify").toLowerCase(),
    }),
    confidence: 0.85,
  },
  // Stop music
  {
    intent: "stop_music",
    patterns: [
      /\b(stop|pause|halt)\s+(the\s+)?(music|song|playback)\b/i,
      /\bstop playing\b/i,
    ],
    confidence: 0.92,
  },
  // Launch app
  {
    intent: "launch_app",
    patterns: [
      /\b(open|launch|start|run)\s+(?<app>.+)/i,
      /\bgo to\s+(?<app>.+)/i,
    ],
    extract: (match) => ({
      app: (match.groups?.["app"] ?? "").trim(),
    }),
    confidence: 0.8,
  },
  // Volume
  {
    intent: "set_volume",
    patterns: [
      /\b(set|turn|change)\s+(volume|vol)\s+(to\s+)?(?<level>\d+)\s*(%|percent)?\b/i,
      /\b(volume|vol)\s+(up|down|max|mute|unmute)\b/i,
    ],
    extract: (match) => ({
      level: match.groups?.["level"] ?? match[0].includes("up") ? "up" : "down",
    }),
    confidence: 0.88,
  },
  // Timer
  {
    intent: "set_timer",
    patterns: [
      /\b(set|start|create)\s+(a\s+)?timer\s+(for\s+)?(?<duration>\d+\s*(hours?|minutes?|mins?|seconds?|secs?))\b/i,
      /\btimer\s+(?<duration>\d+\s*(hours?|minutes?|mins?|seconds?|secs?))\b/i,
    ],
    extract: (match) => ({
      duration: (match.groups?.["duration"] ?? "").trim(),
    }),
    confidence: 0.9,
  },
  // Alarm
  {
    intent: "set_alarm",
    patterns: [
      /\b(set|create|wake me (up\s+)?)\s*(an?\s+)?alarm\s+(at\s+|for\s+)?(?<time>[\d:]+\s*(am|pm)?)\b/i,
      /\balarm\s+(at\s+|for\s+)?(?<time>[\d:]+\s*(am|pm)?)\b/i,
    ],
    extract: (match) => ({
      time: (match.groups?.["time"] ?? "").trim(),
    }),
    confidence: 0.9,
  },
];

// ─── Keywords that definitively signal cloud escalation ───────────────────────

const CLOUD_SIGNALS = [
  /\bwhat\b/i,
  /\bwho\b/i,
  /\bwhere\b/i,
  /\bwhen\b/i,
  /\bhow\b/i,
  /\bwhy\b/i,
  /\bexplain\b/i,
  /\btell me\b/i,
  /\bdefine\b/i,
  /\bsummarise|summarize\b/i,
  /\btranslate\b/i,
  /\bwrite\b/i,
  /\bcode\b/i,
  /\bcalculate|calc\b/i,
  /\bweather\b/i,
  /\bnews\b/i,
  /\bremind me\b/i,
];

// ─── Parser class ─────────────────────────────────────────────────────────────

export class LocalCommandParser {
  parse(text: string): ParsedIntent {
    const normalised = text.trim().toLowerCase();

    // Fast path: obvious cloud signals → skip local matching
    for (const signal of CLOUD_SIGNALS) {
      if (signal.test(normalised)) {
        return this.unknown(text);
      }
    }

    let best: ParsedIntent | null = null;

    for (const rule of RULES) {
      for (const pattern of rule.patterns) {
        const match = normalised.match(pattern);
        if (match) {
          const params = rule.extract ? rule.extract(match, normalised) : {};
          const result: ParsedIntent = {
            intent: rule.intent,
            confidence: rule.confidence,
            params,
            rawText: text,
            isLocal: true,
          };

          if (!best || result.confidence > best.confidence) {
            best = result;
          }
          break; // first matching pattern wins for this rule
        }
      }
    }

    if (best && best.confidence >= 0.75) {
      return best;
    }

    return this.unknown(text);
  }

  private unknown(text: string): ParsedIntent {
    return {
      intent: "unknown",
      confidence: 0,
      params: {},
      rawText: text,
      isLocal: false,
    };
  }
}

// Export default singleton
export const commandParser = new LocalCommandParser();
