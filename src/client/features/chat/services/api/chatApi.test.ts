/**
 * ChatApi Unit Tests
 * 测试纯函数逻辑
 */

import { describe, expect, it } from "vitest";
import type { Message, MessageContent } from "@/features/chat/types/chat";

// 模拟 chatApi 中的纯函数逻辑
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateToolId(): string {
  return `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createUserMessage(text: string): Message {
  return {
    id: generateMessageId(),
    role: "user",
    content: [{ type: "text", text }],
    timestamp: new Date(),
  };
}

function createAssistantMessage(): Message {
  return {
    id: generateMessageId(),
    role: "assistant",
    content: [],
    timestamp: new Date(),
    isStreaming: true,
  };
}

function finalizeStreamingMessage(
  streamingMessage: Message | null,
  streamingContent: string,
  streamingThinking: string
): Message | null {
  if (!streamingMessage) return null;

  const content: MessageContent[] = [];

  if (streamingThinking) {
    content.push({
      type: "thinking",
      thinking: streamingThinking,
    });
  }

  if (streamingContent) {
    content.push({
      type: "text",
      text: streamingContent,
    });
  }

  return {
    ...streamingMessage,
    content,
    isStreaming: false,
  };
}

function extractTextFromMessage(message: Message): string {
  return message.content
    .filter(
      (c): c is MessageContent & { type: "text"; text: string } => c.type === "text" && !!c.text
    )
    .map((c) => c.text)
    .join("\n");
}

describe("ChatApi Utils", () => {
  describe("ID Generation", () => {
    it("should generate message IDs with correct prefix", () => {
      const id = generateMessageId();
      expect(id.startsWith("msg-")).toBe(true);
    });

    it("should generate unique message IDs", () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();
      expect(id1).not.toBe(id2);
    });

    it("should generate tool IDs with correct prefix", () => {
      const id = generateToolId();
      expect(id.startsWith("tool-")).toBe(true);
    });

    it("should generate unique tool IDs", () => {
      const id1 = generateToolId();
      const id2 = generateToolId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("Message Creation", () => {
    it("should create user message with text", () => {
      const msg = createUserMessage("Hello");
      expect(msg.role).toBe("user");
      expect(msg.content).toHaveLength(1);
      expect(msg.content[0].type).toBe("text");
      expect(msg.content[0].text).toBe("Hello");
      expect(msg.timestamp).toBeInstanceOf(Date);
    });

    it("should create assistant message with streaming flag", () => {
      const msg = createAssistantMessage();
      expect(msg.role).toBe("assistant");
      expect(msg.isStreaming).toBe(true);
      expect(msg.content).toHaveLength(0);
    });

    it("should create messages with unique IDs", () => {
      const msg1 = createUserMessage("Hello");
      const msg2 = createUserMessage("World");
      expect(msg1.id).not.toBe(msg2.id);
    });
  });

  describe("Finalize Streaming Message", () => {
    it("should return null for null streaming message", () => {
      const result = finalizeStreamingMessage(null, "content", "thinking");
      expect(result).toBeNull();
    });

    it("should finalize with text content only", () => {
      const streamingMsg = createAssistantMessage();
      const result = finalizeStreamingMessage(streamingMsg, "Final text", "");

      expect(result).not.toBeNull();
      expect(result!.isStreaming).toBe(false);
      expect(result!.content).toHaveLength(1);
      expect(result!.content[0].type).toBe("text");
      expect(result!.content[0].text).toBe("Final text");
    });

    it("should finalize with thinking content only", () => {
      const streamingMsg = createAssistantMessage();
      const result = finalizeStreamingMessage(streamingMsg, "", "Thinking...");

      expect(result!.content).toHaveLength(1);
      expect(result!.content[0].type).toBe("thinking");
      expect(result!.content[0].thinking).toBe("Thinking...");
    });

    it("should finalize with both text and thinking", () => {
      const streamingMsg = createAssistantMessage();
      const result = finalizeStreamingMessage(streamingMsg, "Text", "Thinking");

      expect(result!.content).toHaveLength(2);
      expect(result!.content[0].type).toBe("thinking");
      expect(result!.content[1].type).toBe("text");
    });

    it("should preserve message ID when finalizing", () => {
      const streamingMsg = createAssistantMessage();
      const originalId = streamingMsg.id;
      const result = finalizeStreamingMessage(streamingMsg, "Text", "");

      expect(result!.id).toBe(originalId);
    });

    it("should handle empty content", () => {
      const streamingMsg = createAssistantMessage();
      const result = finalizeStreamingMessage(streamingMsg, "", "");

      expect(result!.content).toHaveLength(0);
    });
  });

  describe("Extract Text From Message", () => {
    it("should extract text from user message", () => {
      const msg = createUserMessage("Hello world");
      const text = extractTextFromMessage(msg);
      expect(text).toBe("Hello world");
    });

    it("should extract text from assistant message with text content", () => {
      const msg: Message = {
        id: "1",
        role: "assistant",
        content: [{ type: "text", text: "Response" }],
        timestamp: new Date(),
      };
      const text = extractTextFromMessage(msg);
      expect(text).toBe("Response");
    });

    it("should join multiple text contents with newlines", () => {
      const msg: Message = {
        id: "1",
        role: "assistant",
        content: [
          { type: "text", text: "Line 1" },
          { type: "text", text: "Line 2" },
        ],
        timestamp: new Date(),
      };
      const text = extractTextFromMessage(msg);
      expect(text).toBe("Line 1\nLine 2");
    });

    it("should skip non-text content", () => {
      const msg: Message = {
        id: "1",
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Thought" },
          { type: "text", text: "Text" },
        ],
        timestamp: new Date(),
      };
      const text = extractTextFromMessage(msg);
      expect(text).toBe("Text");
    });

    it("should return empty string for message without text", () => {
      const msg: Message = {
        id: "1",
        role: "assistant",
        content: [{ type: "thinking", thinking: "Thought" }],
        timestamp: new Date(),
      };
      const text = extractTextFromMessage(msg);
      expect(text).toBe("");
    });
  });
});

console.log("[Test] ChatApi tests loaded");
