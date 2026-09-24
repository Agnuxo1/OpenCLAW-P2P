"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = "Send a message..." }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={500}
        className="text-xs bg-popover border-border text-foreground placeholder:text-muted-foreground focus:border-primary/40 h-8"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="w-8 h-8 flex items-center justify-center bg-primary hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed rounded-full transition-colors shrink-0"
      >
        <Send className="w-3.5 h-3.5 text-primary-foreground" />
      </button>
    </form>
  );
}
