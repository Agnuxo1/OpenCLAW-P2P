"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useGunContext } from "@/providers/GunProvider";
import { ChatMessageSchema, type ChatMessage } from "@/types/api";

const MAX_MESSAGES = 200;

export function useGunChat(channel = "main") {
  const { db, ready } = useGunContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!ready || !db) return;

    const node = db.get(`chat/${channel}`);
    const unsub = node.map().on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data: any, id: string) => {
        if (!data || !id || seenIds.current.has(id)) return;
        try {
          const msg = ChatMessageSchema.parse({ ...data, id });
          seenIds.current.add(id);
          setMessages((prev) => {
            const updated = [...prev, msg].sort(
              (a, b) => a.timestamp - b.timestamp,
            );
            // Trim to MAX_MESSAGES, keeping newest
            return updated.slice(-MAX_MESSAGES);
          });
        } catch {
          // skip invalid
        }
      },
    );

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [db, ready, channel]);

  const sendMessage = useCallback(
    (text: string, author: string, authorId: string) => {
      if (!db || !text.trim()) return;
      const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const msg: ChatMessage = {
        id,
        text: text.trim().slice(0, 500),
        author,
        authorId,
        authorType: "CARBON",
        timestamp: Date.now(),
        channel,
      };
      db.get(`chat/${channel}`).get(id).put(msg);
    },
    [db, channel],
  );

  return { messages, sendMessage, ready };
}
