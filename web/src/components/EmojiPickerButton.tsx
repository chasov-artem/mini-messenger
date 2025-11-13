"use client";

import { useState, useRef, useEffect } from "react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

type EmojiPickerButtonProps = {
  onEmojiClick: (emoji: string) => void;
  className?: string;
  title?: string;
  showQuickReactions?: boolean;
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

export default function EmojiPickerButton({
  onEmojiClick,
  className = "",
  title = "Add reaction",
  showQuickReactions = true,
}: EmojiPickerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  function handleEmojiClick(emojiData: EmojiClickData) {
    onEmojiClick(emojiData.emoji);
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={pickerRef}>
      <div className="flex items-center gap-1">
        {showQuickReactions && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                className="text-xs hover:scale-125 transition-transform"
                onClick={() => onEmojiClick(emoji)}
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <button
          className={className}
          onClick={() => setIsOpen(!isOpen)}
          title={title}
        >
          😀
        </button>
      </div>
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 z-50 shadow-lg rounded-lg overflow-hidden">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={350}
            height={400}
            previewConfig={{ showPreview: false }}
            searchDisabled={false}
            skinTonesDisabled
          />
        </div>
      )}
    </div>
  );
}

