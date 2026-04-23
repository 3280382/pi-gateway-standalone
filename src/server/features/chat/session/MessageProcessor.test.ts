import { describe, expect, it } from "vitest";
import { processSessionEntries } from "./MessageProcessor.js";

describe("session-processor", () => {
  describe("processSessionEntries", () => {
    it("returns empty result for empty entries", () => {
      const result = processSessionEntries([]);
      expect(result.entries).toEqual([]);
      expect(result.messages).toEqual([]);
    });

    it("processes user message", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          timestamp: "2024-01-01T00:00:00Z",
          message: { role: "user", content: "Hello" },
        },
      ];
      const result = processSessionEntries(entries);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].kind1).toBe("user");
      expect(result.messages[0].kind2).toBe("prompt");
      expect(result.messages[0].content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("processes assistant text response", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          timestamp: "2024-01-01T00:00:00Z",
          message: { role: "assistant", content: [{ type: "text", text: "Hi" }] },
        },
      ];
      const result = processSessionEntries(entries);
      expect(result.messages[0].kind1).toBe("assistant");
      expect(result.messages[0].kind2).toBe("response");
      expect(result.messages[0].kind3).toBe("text_response");
    });

    it("processes assistant thinking block", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            role: "assistant",
            content: [
              { type: "thinking", thinking: "thinking..." },
              { type: "text", text: "answer" },
            ],
          },
        },
      ];
      const result = processSessionEntries(entries);
      expect(result.messages[0].kind2).toBe("thinking");
      expect(result.messages[0].kind3).toBe("thinking_block");
    });

    it("processes assistant tool call", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            role: "assistant",
            content: [{ type: "toolCall", id: "t1", name: "bash", arguments: { cmd: "ls" } }],
          },
        },
      ];
      const result = processSessionEntries(entries);
      expect(result.messages[0].kind2).toBe("tool");
      expect(result.messages[0].kind3).toBe("tool_call");
      expect(result.messages[0].content[0].type).toBe("tool_use");
    });

    it("merges tool results into assistant message", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            role: "assistant",
            content: [{ type: "toolCall", id: "t1", name: "bash", arguments: { cmd: "ls" } }],
          },
        },
        {
          id: "msg-2",
          type: "message",
          timestamp: "2024-01-01T00:00:01Z",
          message: {
            role: "toolResult",
            toolCallId: "t1",
            content: [{ type: "text", text: "file.txt" }],
          },
        },
      ];
      const result = processSessionEntries(entries);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content[0].type).toBe("tool");
      expect(result.messages[0].content[0].output).toBe("file.txt");
      expect(result.messages[0].content[0].status).toBe("success");
    });

    it("handles error tool results", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            role: "assistant",
            content: [{ type: "toolCall", id: "t1", name: "bash", arguments: { cmd: "invalid" } }],
          },
        },
        {
          id: "msg-2",
          type: "message",
          timestamp: "2024-01-01T00:00:01Z",
          message: {
            role: "toolResult",
            toolCallId: "t1",
            isError: true,
            content: [{ type: "text", text: "command not found" }],
          },
        },
      ];
      const result = processSessionEntries(entries);
      expect(result.messages[0].content[0].status).toBe("error");
      expect(result.messages[0].content[0].error).toBe("command not found");
      expect(result.messages[0].content[0].output).toBe("command not found");
    });

    it("creates usage message from assistant usage info", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hi" }],
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
        },
      ];
      const result = processSessionEntries(entries);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].kind3).toBe("usage");
      expect(result.messages[1].content[0].text).toContain("150");
      expect(result.messages[1].content[0].text).toContain("100 in / 50 out");
    });

    it("processes model_change event", () => {
      const entries = [{ id: "e1", type: "model_change", provider: "openai", modelId: "gpt-4" }];
      const result = processSessionEntries(entries);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].kind3).toBe("model_change");
      expect(result.messages[0].content[0].text).toContain("openai/gpt-4");
    });

    it("processes thinking_level_change event", () => {
      const entries = [{ id: "e1", type: "thinking_level_change", thinkingLevel: "high" }];
      const result = processSessionEntries(entries);
      expect(result.messages[0].kind3).toBe("thinking_level_change");
      expect(result.messages[0].content[0].text).toContain("high");
    });

    it("processes compaction event", () => {
      const entries = [
        { id: "e1", type: "compaction", summary: "old messages removed", tokensBefore: 5000 },
      ];
      const result = processSessionEntries(entries);
      expect(result.messages[0].kind3).toBe("compaction");
      expect(result.messages[0].content[0].text).toContain("old messages removed");
      expect(result.messages[0].content[0].text).toContain("5000");
    });

    it("processes usage event", () => {
      const entries = [
        {
          id: "e1",
          type: "usage",
          usage: { totalTokens: 200, cost: 0.005, model: "claude-3" },
        },
      ];
      const result = processSessionEntries(entries);
      expect(result.messages[0].kind3).toBe("usage");
      expect(result.messages[0].content[0].text).toContain("200");
      expect(result.messages[0].content[0].text).toContain("claude-3");
    });

    it("skips entries without message", () => {
      const entries = [{ id: "msg-1", type: "message", timestamp: "2024-01-01T00:00:00Z" }];
      const result = processSessionEntries(entries);
      expect(result.messages).toHaveLength(0);
    });

    it("skips unknown special entry types", () => {
      const entries = [{ id: "e1", type: "unknown_event", data: "test" }];
      const result = processSessionEntries(entries);
      expect(result.messages).toHaveLength(0);
    });

    it("normalizes string content to array", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          timestamp: "2024-01-01T00:00:00Z",
          message: { role: "user", content: "plain string" },
        },
      ];
      const result = processSessionEntries(entries);
      expect(result.messages[0].content).toEqual([{ type: "text", text: "plain string" }]);
    });

    it("converts toolCall to tool_use for client compatibility", () => {
      const entries = [
        {
          id: "msg-1",
          type: "message",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            role: "assistant",
            content: [{ type: "toolCall", id: "t1", name: "bash", arguments: {} }],
          },
        },
      ];
      const result = processSessionEntries(entries);
      const content = result.messages[0].content[0];
      expect(content.type).toBe("tool_use");
      expect(content.toolCallId).toBe("t1");
      expect(content.toolName).toBe("bash");
      expect(content.args).toEqual({});
    });
  });
});
