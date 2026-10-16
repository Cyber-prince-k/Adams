/**
 * Convex backend functions for ADAMS conversation history.
 * Deploy with: npx convex dev
 */

import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

// ── Schema note ──────────────────────────────────────────────────────────────
// Add to convex/schema.ts:
//   messages: defineTable({
//     conversationId: v.string(),
//     role: v.union(v.literal("user"), v.literal("assistant")),
//     content: v.string(),
//     createdAt: v.number(),
//   }).index("by_conversation", ["conversationId", "createdAt"]),

// ── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    conversationId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { conversationId, limit = 100 }) => {
    return ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("asc")
      .take(limit);
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

export const insert = mutation({
  args: {
    conversationId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("messages", args);
  },
});

export const clearConversation = mutation({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .collect();

    await Promise.all(rows.map((r) => ctx.db.delete(r._id)));
    return rows.length;
  },
});
