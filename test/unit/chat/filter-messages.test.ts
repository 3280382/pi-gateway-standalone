/**
 * Unit tests for filterMessages content-block-level filtering
 * Regression for: messages containing multiple content types escaping filters
 */

import { describe, expect, it } from "vitest";
import { filterMessages } from "../../../src/client/features/chat/stores/chatStore";
import type { Message } from "../../../src/client/features/chat/types/chat";

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "test-msg",
    role: "assistant",
    kind1: "assistant",
    kind2: "response",
    content: [{ type: "text", text: "hello" }],
    timestamp: Date.now(),
    ...overrides,
  } as Message;
}

const defaultFilters = {
  kind1: { user: true, assistant: true, sysinfo: true },
  kind2: { prompt: true, response: true, thinking: true, tool: true, event: true },
  kind3: {
    modelChange: true,
    thinkingLevelChange: true,
    compaction: true,
    retry: true,
    autoRetry: true,
    usage: true,
    toolSuccess: true,
    toolError: true,
    toolPending: true,
  },
};

describe("filterMessages content-block-level filtering", () => {
  it("should hide assistant message containing thinking when thinking filter is off", () => {
    const messages: Message[] = [
      createMessage({
        id: "msg1",
        kind2: "thinking",
        kind3: "thinking_block",
        content: [
          { type: "thinking", thinking: "Let me think..." },
          { type: "text", text: "Here is the answer" },
        ],
      }),
    ];

    const result = filterMessages(messages, {
      query: "",
      filters: {
        ...defaultFilters,
        kind2: { ...defaultFilters.kind2, thinking: false },
      },
    });

    expect(result).toHaveLength(0);
  });

  it("should hide assistant message containing tool when tool filter is off", () => {
    const messages: Message[] = [
      createMessage({
        id: "msg1",
        kind2: "tool",
        kind3: "tool_call",
        content: [
          { type: "thinking", thinking: "Let me use a tool" },
          { type: "tool_use", toolName: "bash", toolCallId: "t1", args: "{}", output: "done" },
          { type: "text", text: "Done!" },
        ],
      }),
    ];

    const result = filterMessages(messages, {
      query: "",
      filters: {
        ...defaultFilters,
        kind2: { ...defaultFilters.kind2, tool: false },
      },
    });

    expect(result).toHaveLength(0);
  });

  it("should hide assistant message containing text when response filter is off", () => {
    const messages: Message[] = [
      createMessage({
        id: "msg1",
        kind2: "response",
        content: [{ type: "text", text: "Hello world" }],
      }),
    ];

    const result = filterMessages(messages, {
      query: "",
      filters: {
        ...defaultFilters,
        kind2: { ...defaultFilters.kind2, response: false },
      },
    });

    expect(result).toHaveLength(0);
  });

  it("should show message when all its content types are enabled", () => {
    const messages: Message[] = [
      createMessage({
        id: "msg1",
        kind2: "tool",
        kind3: "tool_call",
        content: [
          { type: "thinking", thinking: "Let me think" },
          { type: "tool_use", toolName: "bash", toolCallId: "t1", args: "{}" },
          { type: "text", text: "Result" },
        ],
      }),
    ];

    const result = filterMessages(messages, {
      query: "",
      filters: defaultFilters,
    });

    expect(result).toHaveLength(1);
  });

  it("should not affect user messages", () => {
    const messages: Message[] = [
      createMessage({
        id: "msg1",
        role: "user",
        kind1: "user",
        kind2: "prompt",
        content: [{ type: "text", text: "Hello" }],
      }),
    ];

    const result = filterMessages(messages, {
      query: "",
      filters: {
        ...defaultFilters,
        kind2: { ...defaultFilters.kind2, thinking: false },
      },
    });

    expect(result).toHaveLength(1);
  });

  it("should hide sysinfo events when event filter is off", () => {
    const messages: Message[] = [
      createMessage({
        id: "msg1",
        role: "system",
        kind1: "sysinfo",
        kind2: "event",
        kind3: "model_change",
        content: [{ type: "text", text: "Model changed" }],
      }),
    ];

    const result = filterMessages(messages, {
      query: "",
      filters: {
        ...defaultFilters,
        kind2: { ...defaultFilters.kind2, event: false },
      },
    });

    expect(result).toHaveLength(0);
  });
});
