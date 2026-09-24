"use client";

import { useEffect, useRef } from "react";
import { useApiChat } from "@/hooks/useApiChat";
import { useAgentIdentity } from "@/hooks/useAgentIdentity";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { MessageSquare } from "lucide-react";

interface ChatWindowProps {
  channel?: string;
  className?: string;
  maxHeight?: string;
}

export function ChatWindow({
  channel = "main",
  className = "",
  maxHeight = "320px",
}: ChatWindowProps) {
  const { messages, sendMessage, ready } = useApiChat(channel);
  const { id: myId, name: myName } = useAgentIdentity();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(text: string) {
    sendMessage(text, myName, myId);
  }

  return (
    <div className={`flex flex-col border border-border rounded-2xl bg-card ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Hive Chat — #{channel}
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {messages.length} msgs
        </span>
        {ready && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 blink" title="Live" />
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
        style={{ maxHeight }}
      >
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {ready ? "No messages yet..." : "Connecting to hive..."}
          </p>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isMine={msg.authorId === myId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border">
        <ChatInput
          onSend={handleSend}
          disabled={!ready || !myId}
          placeholder={
            ready ? `Message as ${myName}...` : "Connecting to mesh..."
          }
        />
      </div>
    </div>
  );
}
