/**
 * ConversationSync
 *
 * Optional cross-device conversation history sync using Convex.
 * When EXPO_PUBLIC_CONVEX_URL is not set, all methods are no-ops
 * so the app works fully offline without any changes to call sites.
 *
 * Schema (Convex table: "messages"):
 *   conversationId  string  (groups messages into a session)
 *   role            "user" | "assistant"
 *   content         string
 *   createdAt       number  (Unix ms)
 *
 * Usage:
 *   const sync = new ConversationSync(conversationId);
 *   await sync.init();
 *   await sync.persist(message);
 *   const history = await sync.loadHistory();
 */

import type { Message } from "../../types";

const CONVEX_URL = process.env["EXPO_PUBLIC_CONVEX_URL"] ?? "";

// ─── Types matching our Convex schema ────────────────────────────────────────

interface ConvexMessage {
  _id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

// ─── Lazy Convex client ───────────────────────────────────────────────────────

let convexClient: import("convex/browser").ConvexHttpClient | null = null;

async function getConvexClient(): Promise<import("convex/browser").ConvexHttpClient | null> {
  if (!CONVEX_URL) return null;
  if (convexClient) return convexClient;

  try {
    const { ConvexHttpClient } = await import("convex/browser");
    convexClient = new ConvexHttpClient(CONVEX_URL);
    return convexClient;
  } catch (err) {
    console.warn("[ADAMS Sync] Convex not available:", err);
    return null;
  }
}

// ─── ConversationSync class ───────────────────────────────────────────────────

export class ConversationSync {
  private conversationId: string;
  private enabled: boolean;

  constructor(conversationId: string) {
    this.conversationId = conversationId;
    this.enabled = !!CONVEX_URL;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Persist a single message to Convex.
   * No-op if Convex is not configured.
   */
  async persist(message: Message): Promise<void> {
    if (!this.enabled) return;
    const client = await getConvexClient();
    if (!client) return;

    try {
      // Use the Convex HTTP action endpoint
      await client.action("messages:insert" as never, {
        conversationId: this.conversationId,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      });
    } catch (err) {
      // Sync failures are non-fatal — local chat continues working
      console.warn("[ADAMS Sync] persist failed:", err);
    }
  }

  /**
   * Load conversation history from Convex.
   * Returns [] if Convex is not configured or fails.
   */
  async loadHistory(): Promise<Message[]> {
    if (!this.enabled) return [];
    const client = await getConvexClient();
    if (!client) return [];

    try {
      const rows = await client.query("messages:list" as never, {
        conversationId: this.conversationId,
        limit: 100,
      }) as ConvexMessage[];

      return rows.map((row) => ({
        id: row._id,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt,
      }));
    } catch (err) {
      console.warn("[ADAMS Sync] loadHistory failed:", err);
      return [];
    }
  }

  /**
   * Delete all messages for this conversation.
   */
  async clear(): Promise<void> {
    if (!this.enabled) return;
    const client = await getConvexClient();
    if (!client) return;

    try {
      await client.action("messages:clearConversation" as never, {
        conversationId: this.conversationId,
      });
    } catch (err) {
      console.warn("[ADAMS Sync] clear failed:", err);
    }
  }
}
