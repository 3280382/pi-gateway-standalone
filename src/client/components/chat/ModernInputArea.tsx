/**
 * ModernInputArea - Sleek input with slash command support
 */

import React, { useRef, useEffect, useState } from "react";
import { Send, Command, X } from "lucide-react";
import { useMobile } from "@/features/chat/hooks/useMobile";
import styles from "./ModernInputArea.module.css";

// BUILTIN_SLASH_COMMANDS from Pi SDK
const SLASH_COMMANDS = [
  { name: "compact", description: "Compress session context", args: "[instructions]" },
  { name: "export", description: "Export session to HTML/JSONL", args: "[path]" },
  { name: "session", description: "Show session info and stats" },
  { name: "name", description: "Set session display name", args: "<name>" },
  { name: "copy", description: "Copy last assistant message" },
  { name: "clear", description: "Start a new session" },
  { name: "new", description: "Start a new session" },
  { name: "bash", description: "Execute bash command", args: "<command>" },
  { name: "ls", description: "List directory contents", args: "[path]" },
  { name: "cat", description: "Display file contents", args: "<file>" },
  { name: "grep", description: "Search file contents", args: "<pattern> [file]" },
  { name: "find", description: "Find files", args: "<path> [name]" },
  { name: "pwd", description: "Print working directory" },
  { name: "settings", description: "Open settings menu (UI required)" },
  { name: "model", description: "Select model (UI required)" },
  { name: "fork", description: "Create branch from message (UI required)" },
  { name: "tree", description: "Navigate session tree (UI required)" },
  { name: "login", description: "OAuth login (UI required)" },
  { name: "logout", description: "OAuth logout" },
  { name: "import", description: "Import session from JSONL", args: "<path>" },
  { name: "share", description: "Share as GitHub gist" },
  { name: "hotkeys", description: "Show keyboard shortcuts" },
  { name: "changelog", description: "Show changelog" },
];

interface ModernInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAbort?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const ModernInputArea: React.FC<ModernInputAreaProps> = ({
  value,
  onChange,
  onSend,
  onAbort,
  isStreaming = false,
  disabled = false,
  placeholder = "Message...",
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isMobile, keyboardOpen } = useMobile();
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Show slash menu when typing "/"
  useEffect(() => {
    if (value.startsWith("/") && !value.includes(" ")) {
      setShowCommands(true);
      setSelectedIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [value]);

  const filteredCommands = SLASH_COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().includes(value.slice(1).toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? filteredCommands.length - 1 : prev - 1
        );
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          onChange(`/${cmd.name} `);
          setShowCommands(false);
        }
      } else if (e.key === "Escape") {
        setShowCommands(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming && onAbort) {
        onAbort();
      } else if (value.trim()) {
        onSend();
      }
    }
  };

  const handleCommandClick = (cmd: typeof SLASH_COMMANDS[0]) => {
    onChange(`/${cmd.name} `);
    textareaRef.current?.focus();
    setShowCommands(false);
  };

  return (
    <div className={`${styles.container} ${keyboardOpen ? styles.keyboardOpen : ""}`}>
      {/* Slash Command Menu */}
      {showCommands && filteredCommands.length > 0 && (
        <div className={styles.commandMenu}>
          <div className={styles.commandList}>
            {filteredCommands.map((cmd, index) => (
              <button
                key={cmd.name}
                className={`${styles.commandItem} ${
                  index === selectedIndex ? styles.selected : ""
                }`}
                onClick={() => handleCommandClick(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className={styles.commandName}>/{cmd.name}</span>
                {cmd.args && (
                  <span className={styles.commandArgs}>{cmd.args}</span>
                )}
                <span className={styles.commandDesc}>{cmd.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Container */}
      <div className={styles.inputContainer}>
        <div className={styles.inputWrapper}>
          {value.startsWith("/") && (
            <div className={styles.slashIndicator}>
              <Command size={14} />
            </div>
          )}

          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
          />

          {value && (
            <button
              className={styles.clearButton}
              onClick={() => onChange("")}
              aria-label="Clear input"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          className={`${styles.sendButton} ${
            isStreaming ? styles.abortButton : ""
          }`}
          onClick={isStreaming && onAbort ? onAbort : onSend}
          disabled={!isStreaming && !value.trim()}
          aria-label={isStreaming ? "Abort" : "Send"}
        >
          <Send size={18} />
        </button>
      </div>

      {/* Mobile hint */}
      {isMobile && (
        <div className={styles.mobileHint}>
          <span>Type / for commands</span>
        </div>
      )}
    </div>
  );
};

export default ModernInputArea;
