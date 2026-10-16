/**
 * /api/chat — Expo Router server-side API route
 *
 * Proxies streaming LLM requests through the server so API keys
 * are never exposed to the browser client (web tier).
 *
 * POST /api/chat
 * Body: { messages: Message[], provider?, model? }
 * Response: text/event-stream (SSE)
 *
 * This route only runs when the app is deployed as a server-rendered
 * web app (expo web --output server). It is not used by the mobile app,
 * which calls the LLM directly from the device.
 */

import { ExpoRequest, ExpoResponse } from "expo-router/server";
import type { Message, LLMProvider } from "../../src/types";
import { DEFAULT_SYSTEM_PROMPT } from "../../src/constants";

export async function POST(req: ExpoRequest): Promise<ExpoResponse> {
  const body = (await req.json()) as {
    messages: Message[];
    provider?: LLMProvider;
    model?: string;
  };

  const provider: LLMProvider =
    body.provider ?? (process.env["EXPO_PUBLIC_LLM_PROVIDER"] as LLMProvider) ?? "openai";
  const model =
    body.model ??
    process.env["EXPO_PUBLIC_LLM_MODEL"] ??
    (provider === "openai" ? "gpt-4o-mini" : provider === "deepseek" ? "deepseek-chat" : "llama3.2");

  const baseURL =
    provider === "openai"
      ? "https://api.openai.com/v1"
      : provider === "deepseek"
      ? "https://api.deepseek.com/v1"
      : `${process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434"}/v1`;

  const apiKey =
    provider === "openai"
      ? process.env["OPENAI_API_KEY"] ?? ""
      : provider === "deepseek"
      ? process.env["DEEPSEEK_API_KEY"] ?? ""
      : "ollama";

  const oaiMessages = [
    { role: "system", content: DEFAULT_SYSTEM_PROMPT },
    ...body.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const upstream = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: oaiMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!upstream.ok) {
    const txt = await upstream.text();
    return new ExpoResponse(JSON.stringify({ error: txt }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream the SSE response straight through
  return new ExpoResponse(upstream.body as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
