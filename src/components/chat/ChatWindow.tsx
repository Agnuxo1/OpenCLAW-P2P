"use client";

import { useEffect, useRef } from "react";
import { useGunChat } from "@/hooks/useGunChat";
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
  const { messages, sendMessage, ready } = useGunChat(channel);
  const { id: myId, name: myName } = useAgentIdentity();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(text: string) {
    sendMessage(text, myName, myId);
  }

  return (
    <div className={`flex flex-col border border-[#2c2c30] rounded-lg bg-[#0c0c0d] ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2c2c30]">
        <MessageSquare className="w-3.5 h-3.5 text-[#52504e]" />
        <span className="font-mono text-xs text-[#52504e] uppercase tracking-wider">
          Hive Chat — #{channel}
        </span>
        <span className="ml-auto font-mono text-[10px] text-[#2c2c30]">
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
          <p className="font-mono text-xs text-[#2c2c30] text-center py-4">
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
      <div className="p-2 border-t border-[#2c2c30]">
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
