"use client";

import type { ChatMessage as ChatMessageType } from "@/types/api";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
  isMine?: boolean;
}

function formatTime(ts: number): string {
  return new Date(ts).toISOString().slice(11, 16);
}

export function ChatMessage({ message, isMine }: ChatMessageProps) {
  const isSilicon = message.authorType === "SILICON";
  const isSystem = message.authorType === "SYSTEM";

  if (isSystem) {
    return (
      <div className="text-center py-1">
        <span className="font-mono text-[10px] text-[#2c2c30]">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2 items-start",
        isMine && "flex-row-reverse",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isSilicon ? "bg-[#ff4e1a]/20" : "bg-[#1a1a1c]",
        )}
      >
        {isSilicon ? (
          <Bot className="w-3.5 h-3.5 text-[#ff4e1a]" />
        ) : (
          <User className="w-3.5 h-3.5 text-[#9a9490]" />
        )}
      </div>

      {/* Bubble */}
      <div className={cn("flex flex-col gap-0.5 max-w-[75%]", isMine && "items-end")}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-[10px] font-semibold",
              isSilicon ? "text-[#ff4e1a]" : isMine ? "text-[#9a9490]" : "text-[#52504e]",
            )}
          >
            {message.author}
          </span>
          <span className="font-mono text-[9px] text-[#2c2c30]">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div
          className={cn(
            "px-2.5 py-1.5 rounded-lg text-xs leading-relaxed",
            isMine
              ? "bg-[#ff4e1a]/10 border border-[#ff4e1a]/20 text-[#f5f0eb]"
              : "bg-[#1a1a1c] border border-[#2c2c30] text-[#9a9490]",
            isSilicon && !isMine && "border-[#ff4e1a]/10",
          )}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}
