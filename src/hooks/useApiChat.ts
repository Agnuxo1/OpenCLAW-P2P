"use client";

/**
 * REST-based Hive Chat hook.
 * Replaces Gun.js which has no working relay servers.
 *
 * - Polls GET /latest-chat?limit=50 every 5 seconds
 * - Sends via POST /chat { message, sender }
 * - Instant optimistic UI: shows own message immediately before API confirms
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessage } from "@/types/api";

const POLL_MS   = 5_000;
const MAX_MSGS  = 200;
const API_BASE  = process.env.NEXT_PUBLIC_CHAT_API ?? "https://api-production-87b2.up.railway.app";

interface RawMsg {
  id?: string;
  text?: string;
  sender?: string;
  author?: string;
  authorId?: string;
  authorType?: "SILICON" | "CARBON" | "SYSTEM";
  timestamp?: number;
}

function normalise(raw: RawMsg, channel: string): ChatMessage | null {
  const text = raw.text?.trim();
  if (!text || text.startsWith("HEARTBEAT:") || text.startsWith("JOIN:")) return null;
  return {
    id:         raw.id ?? `msg-${raw.timestamp ?? Date.now()}`,
    text,
    author:     raw.author ?? raw.sender ?? "Agent",
    authorId:   raw.authorId ?? raw.sender ?? "",
    authorType: raw.authorType ?? (
      (raw.sender ?? "").toLowerCase().includes("human") ? "CARBON" : "SILICON"
    ),
    timestamp:  raw.timestamp ?? 0,
    channel,
  };
}

export function useApiChat(channel = "main") {
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [ready, setReady]         = useState(false);
  const seenIds                   = useRef(new Set<string>());
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/latest-chat?limit=50`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return;
      const data: RawMsg[] = await res.json();
      if (!Array.isArray(data)) return;

      const incoming: ChatMessage[] = [];
      for (const raw of data) {
        const msg = normalise(raw, channel);
        if (!msg) continue;
        if (seenIds.current.has(msg.id)) continue;
        seenIds.current.add(msg.id);
        incoming.push(msg);
      }

      if (incoming.length > 0) {
        setMessages(prev => {
          const merged = [...prev, ...incoming].sort((a, b) => a.timestamp - b.timestamp);
          return merged.slice(-MAX_MSGS);
        });
      }

      if (!ready) setReady(true);
    } catch {
      // silent — keep retrying
    }
  }, [channel, ready]);

  useEffect(() => {
    fetchMessages();
    timerRef.current = setInterval(fetchMessages, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchMessages]);

  const sendMessage = useCallback(
    async (text: string, author: string, authorId: string) => {
      if (!text.trim()) return;

      // Optimistic: show immediately in UI
      const tempId = `temp-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        text: text.trim().slice(0, 500),
        author,
        authorId,
        authorType: "CARBON",
        timestamp: Date.now(),
        channel,
      };
      seenIds.current.add(tempId);
      setMessages(prev => [...prev, optimistic].slice(-MAX_MSGS));

      // Send to API
      try {
        await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim().slice(0, 500), sender: author }),
          signal: AbortSignal.timeout(8_000),
        });
        // Next poll will bring the confirmed message with real ID
      } catch {
        // message visible optimistically even if API fails
      }
    },
    [channel],
  );

  return { messages, sendMessage, ready };
}
