import { describe, expect, it } from "vitest";
import {
  handleServerMessages,
  normalizeContent,
  normalizeContentItem,
  normalizeSessionMessages,
} from "./messageUtils";

describe("messageUtils", () => {
  describe("handleServerMessages", () => {
    it("returns empty array for empty input", () => {
      expect(handleServerMessages([])).toEqual([]);
    });

    it("returns empty array for null/undefined", () => {
      expect(handleServerMessages(null as any)).toEqual([]);
      expect(handleServerMessages(undefined as any)).toEqual([]);
    });

    it("returns messages as-is", () => {
      const messages = [{ id: "1", text: "hello" }];
      expect(handleServerMessages(messages)).toEqual(messages);
    });
  });

  describe("normalizeContent", () => {
    it.each([
      [null, []],
      [undefined, []],
      ["", []],
      ["hello", [{ type: "text", text: "hello" }]],
      [[{ type: "text", text: "hi" }], [{ type: "text", text: "hi" }]],
      [{ key: "value" }, [{ key: "value" }]],
      [123, [{ type: "text", text: "123" }]],
    ])("normalizes %s → %s", (input, expected) => {
      expect(normalizeContent(input)).toEqual(expected);
    });
  });

  describe("normalizeContentItem", () => {
    it("normalizes thinking content", () => {
      const item = { type: "thinking", thinking: "deep thought", signature: "abc" };
      expect(normalizeContentItem(item)).toEqual({
        type: "thinking",
        thinking: "deep thought",
        signature: "abc",
      });
    });

    it("normalizes text content", () => {
      const item = { type: "text", text: "hello" };
      expect(normalizeContentItem(item)).toEqual({ type: "text", text: "hello" });
    });

    it("normalizes toolCall content", () => {
      const item = {
        type: "toolCall",
        id: "t1",
        name: "bash",
        arguments: { cmd: "ls" },
      };
      expect(normalizeContentItem(item)).toEqual({
        type: "tool_use",
        toolCallId: "t1",
        toolName: "bash",
        args: { cmd: "ls" },
        partialArgs: undefined,
      });
    });

    it("normalizes toolResult content", () => {
      const item = {
        type: "toolResult",
        toolCallId: "t1",
        toolName: "bash",
        content: [{ type: "text", text: "output" }],
      };
      expect(normalizeContentItem(item)).toEqual({
        type: "tool",
        toolCallId: "t1",
        toolName: "bash",
        output: "output",
        error: undefined,
        args: {},
      });
    });

    it("normalizes image content", () => {
      const item = { type: "image", imageUrl: "http://example.com/img.png" };
      expect(normalizeContentItem(item)).toEqual({
        type: "image",
        imageUrl: "http://example.com/img.png",
      });
    });

    it("defaults unknown types to text", () => {
      expect(normalizeContentItem({ type: "unknown", text: "test" })).toEqual({
        type: "text",
        text: "test",
      });
    });

    it("handles null/undefined input", () => {
      expect(normalizeContentItem(null)).toEqual({ type: "text", text: "" });
      expect(normalizeContentItem(undefined)).toEqual({ type: "text", text: "" });
    });
  });

  describe("normalizeSessionMessages", () => {
    it("returns empty array for empty input", () => {
      expect(normalizeSessionMessages([])).toEqual([]);
    });

    it("normalizes user messages", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          message: { role: "user", content: "hello", timestamp: "2024-01-01T00:00:00Z" },
        },
      ];
      const result = normalizeSessionMessages(entries);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("user");
      expect(result[0].content).toEqual([{ type: "text", text: "hello" }]);
    });

    it("normalizes assistant messages", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "hi there" }],
            timestamp: "2024-01-01T00:00:00Z",
          },
        },
      ];
      const result = normalizeSessionMessages(entries);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("assistant");
    });

    it("skips toolResult entries", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          message: { role: "user", content: "test" },
        },
        {
          id: "msg-2",
          type: "message",
          message: { role: "toolResult", toolCallId: "t1", content: "result" },
        },
      ];
      const result = normalizeSessionMessages(entries);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("user");
    });

    it("handles special entry types", () => {
      const entries = [
        { id: "e1", type: "model_change", provider: "openai", modelId: "gpt-4" },
        { id: "e2", type: "thinking_level_change", thinkingLevel: "high" },
        { id: "e3", type: "compaction", summary: "compacted", tokensBefore: 1000 },
      ];
      const result = normalizeSessionMessages(entries);
      expect(result).toHaveLength(3);
      expect(result[0].role).toBe("system");
      expect(result[0].content[0].text).toContain("Model switched");
      expect(result[1].content[0].text).toContain("Thinking level");
      expect(result[2].content[0].text).toContain("Context compaction");
    });

    it("handles usage entries", () => {
      const entries = [
        {
          id: "e1",
          type: "usage",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        },
      ];
      const result = normalizeSessionMessages(entries);
      expect(result).toHaveLength(1);
      expect(result[0].content[0].text).toContain("150");
    });

    it("merges tool results with tool calls using parentId", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          message: {
            role: "assistant",
            content: [{ type: "toolCall", id: "t1", name: "bash", arguments: { cmd: "ls" } }],
          },
        },
        {
          id: "msg-2",
          type: "message",
          parentId: "msg-1",
          message: {
            role: "toolResult",
            toolCallId: "t1",
            content: [{ type: "text", text: "file.txt" }],
          },
        },
      ];
      const result = normalizeSessionMessages(entries);
      expect(result).toHaveLength(1);
      expect(result[0].content).toHaveLength(1);
      expect(result[0].content[0].type).toBe("tool");
      expect(result[0].content[0].output).toBe("file.txt");
    });
  });
});
