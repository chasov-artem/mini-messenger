"use client";

import { useState, useRef, useEffect } from "react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

type EmojiPickerButtonProps = {
  onEmojiClick: (emoji: string) => void;
  className?: string;
  title?: string;
  showQuickReactions?: boolean;
  openDirection?: "top" | "bottom" | "auto";
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

export default function EmojiPickerButton({
  onEmojiClick,
  className = "",
  title = "Add reaction",
  showQuickReactions = true,
  openDirection = "auto",
}: EmojiPickerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate position based on openDirection prop
  const calculatePosition = (): "top" | "bottom" => {
    if (openDirection === "top") {
      return "top";
    }
    if (openDirection === "bottom") {
      return "bottom";
    }
    // Auto: check available space and adjust position
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      // If there's more space below than above, open downward
      if (spaceBelow > spaceAbove && spaceAbove < 450) {
        return "bottom";
      }
    }
    return "top";
  };

  const handleToggleOpen = () => {
    if (!isOpen) {
      // Calculate position before opening
      const newPosition = calculatePosition();
      setPosition(newPosition);
    }
    setIsOpen(!isOpen);
  };

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
          ref={buttonRef}
          className={className}
          onClick={handleToggleOpen}
          title={title}
        >
          😀
        </button>
      </div>
      {isOpen && (
        <div
          className={`absolute ${
            position === "top" ? "bottom-full mb-2" : "top-full mt-2"
          } right-0 z-[9999] shadow-lg rounded-lg overflow-hidden`}
          style={{
            fontFamily:
              '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiSymbols", "EmojiOne Mozilla", "Segoe UI Symbol", sans-serif',
          }}
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={350}
            height={400}
            previewConfig={{ showPreview: false }}
            searchDisabled={false}
            skinTonesDisabled
            emojiStyle="google"
            lazyLoadEmojis={true}
          />
        </div>
      )}
    </div>
  );
}
