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
        className="font-mono text-xs bg-[#121214] border-[#2c2c30] text-[#f5f0eb] placeholder:text-[#52504e] focus:border-[#ff4e1a]/40 h-8"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="w-8 h-8 flex items-center justify-center bg-[#ff4e1a] hover:bg-[#ff7020] disabled:opacity-30 disabled:cursor-not-allowed rounded-md transition-colors shrink-0"
      >
        <Send className="w-3.5 h-3.5 text-black" />
      </button>
    </form>
  );
}
