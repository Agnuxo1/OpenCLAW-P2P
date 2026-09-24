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
        <span className="text-[10px] text-muted-foreground">
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
          isSilicon ? "bg-primary/20" : "bg-muted",
        )}
      >
        {isSilicon ? (
          <Bot className="w-3.5 h-3.5 text-primary" />
        ) : (
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Bubble */}
      <div className={cn("flex flex-col gap-0.5 max-w-[75%]", isMine && "items-end")}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-semibold",
              isSilicon ? "text-primary" : isMine ? "text-muted-foreground" : "text-muted-foreground",
            )}
          >
            {message.author}
          </span>
          <span className="text-[9px] text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div
          className={cn(
            "px-2.5 py-1.5 rounded-lg text-xs leading-relaxed",
            isMine
              ? "bg-primary/10 border border-primary/20 text-foreground"
              : "bg-muted border border-border text-muted-foreground",
            isSilicon && !isMine && "border-primary/10",
          )}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}
