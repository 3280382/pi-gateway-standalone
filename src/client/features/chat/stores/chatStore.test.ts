/**
 * Chat Store Tests
 * Tests for chatStore state management using Zustand
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestLogger, TestReporter } from "../../../../../test/lib/test-utils";

const logger = new TestLogger("chat-store");
const reporter = new TestReporter("chat-store");

// Mock zustand persist middleware
vi.mock("zustand/middleware", () => ({
  persist: (config: any) => config,
  devtools: (config: any) => config,
}));

// Mock the persist config
vi.mock("./persist.config", () => ({
  CHAT_STORAGE_KEYS: {
    CHAT_STORE: "chat-store",
  },
}));

describe("Chat Store", () => {
  beforeEach(() => {
    logger.info("Resetting test state");
    vi.clearAllMocks();
  });

  it("initializes with default state", async () => {
    await reporter.runTest("default state initialization", async () => {
      // Import the store after mocks are set up
      const { useChatStore } = await import("./chatStore");
      const state = useChatStore.getState();

      // Verify default state
      expect(state.messages).toEqual([]);
      expect(state.currentStreamingMessage).toBeNull();
      expect(state.inputText).toBe("");
      expect(state.isStreaming).toBe(false);
      expect(state.isRunning).toBe(false);
      expect(state.showThinking).toBe(true);
      expect(state.showTools).toBe(true);
      expect(state.searchQuery).toBe("");
      expect(state.sessionId).toBeNull();
      expect(state.currentModel).toBeNull();
      logger.info("Default state verified");
    });
  });

  it("can set input text", async () => {
    await reporter.runTest("set input text", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.setInputText("Hello, world!");
      expect(useChatStore.getState().inputText).toBe("Hello, world!");
      logger.info("Input text set successfully");
    });
  });

  it("can clear input", async () => {
    await reporter.runTest("clear input", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.setInputText("Test message");
      expect(useChatStore.getState().inputText).toBe("Test message");

      store.clearInput();
      expect(useChatStore.getState().inputText).toBe("");
      logger.info("Input cleared successfully");
    });
  });

  it("can add messages", async () => {
    await reporter.runTest("add messages", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      const message = {
        id: "test-msg-1",
        role: "user" as const,
        content: [{ type: "text" as const, text: "Test message" }],
        timestamp: new Date(),
      };

      store.addMessage(message);
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0].id).toBe("test-msg-1");
      logger.info("Message added successfully");
    });
  });

  it("can set messages", async () => {
    await reporter.runTest("set messages", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      const messages = [
        {
          id: "msg-1",
          role: "user" as const,
          content: [{ type: "text" as const, text: "Hello" }],
          timestamp: new Date(),
        },
        {
          id: "msg-2",
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "Hi there" }],
          timestamp: new Date(),
        },
      ];

      store.setMessages(messages);
      expect(useChatStore.getState().messages).toHaveLength(2);
      logger.info("Messages set successfully");
    });
  });

  it("can clear messages", async () => {
    await reporter.runTest("clear messages", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.addMessage({
        id: "msg-1",
        role: "user" as const,
        content: [{ type: "text" as const, text: "Test" }],
        timestamp: new Date(),
      });

      store.clearMessages();
      expect(useChatStore.getState().messages).toHaveLength(0);
      logger.info("Messages cleared successfully");
    });
  });

  it("handles streaming state", async () => {
    await reporter.runTest("handle streaming state", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      // Start streaming
      store.startStreaming();
      expect(useChatStore.getState().isStreaming).toBe(true);
      expect(useChatStore.getState().currentStreamingMessage).not.toBeNull();

      // Finish streaming
      store.finishStreaming();
      expect(useChatStore.getState().isStreaming).toBe(false);
      expect(useChatStore.getState().currentStreamingMessage).toBeNull();
      logger.info("Streaming state handled correctly");
    });
  });

  it("can abort streaming", async () => {
    await reporter.runTest("abort streaming", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.startStreaming();
      expect(useChatStore.getState().isStreaming).toBe(true);

      store.abortStreaming();
      expect(useChatStore.getState().isStreaming).toBe(false);
      logger.info("Streaming aborted successfully");
    });
  });

  it("can set session ID", async () => {
    await reporter.runTest("set session ID", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.setSessionId("session-123");
      expect(useChatStore.getState().sessionId).toBe("session-123");
      logger.info("Session ID set successfully");
    });
  });

  it("can set current model", async () => {
    await reporter.runTest("set current model", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.setCurrentModel("claude-3-opus");
      expect(useChatStore.getState().currentModel).toBe("claude-3-opus");
      logger.info("Current model set successfully");
    });
  });

  it("can set search query", async () => {
    await reporter.runTest("set search query", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.setSearchQuery("test query");
      expect(useChatStore.getState().searchQuery).toBe("test query");
      logger.info("Search query set successfully");
    });
  });

  it("can toggle show thinking", async () => {
    await reporter.runTest("toggle show thinking", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      expect(useChatStore.getState().showThinking).toBe(true);
      store.setShowThinking(false);
      expect(useChatStore.getState().showThinking).toBe(false);
      logger.info("Show thinking toggled successfully");
    });
  });

  it("can reset state", async () => {
    await reporter.runTest("reset state", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.setInputText("test");
      store.setSessionId("session-123");
      store.addMessage({
        id: "msg-1",
        role: "user" as const,
        content: [{ type: "text" as const, text: "Test" }],
        timestamp: new Date(),
      });

      store.reset();

      expect(useChatStore.getState().inputText).toBe("");
      expect(useChatStore.getState().sessionId).toBeNull();
      expect(useChatStore.getState().messages).toHaveLength(0);
      logger.info("State reset successfully");
    });
  });

  it("handles streaming content updates", async () => {
    await reporter.runTest("streaming content updates", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.startStreaming();

      store.appendStreamingContent("Hello");
      expect(useChatStore.getState().streamingContent).toBe("Hello");

      store.appendStreamingContent(" World");
      expect(useChatStore.getState().streamingContent).toBe("Hello World");
      logger.info("Streaming content updates handled correctly");
    });
  });

  it("handles streaming thinking updates", async () => {
    await reporter.runTest("streaming thinking updates", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.startStreaming();

      store.appendStreamingThinking("Let me think...");
      expect(useChatStore.getState().streamingThinking).toBe("Let me think...");
      logger.info("Streaming thinking updates handled correctly");
    });
  });

  it("can prepend messages for loading history", async () => {
    await reporter.runTest("prepend messages", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.addMessage({
        id: "msg-2",
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "New message" }],
        timestamp: new Date(),
      });

      const oldMessages = [
        {
          id: "msg-1",
          role: "user" as const,
          content: [{ type: "text" as const, text: "Old message" }],
          timestamp: new Date(),
        },
      ];

      store.prependMessages(oldMessages);
      expect(useChatStore.getState().messages).toHaveLength(2);
      expect(useChatStore.getState().messages[0].id).toBe("msg-1");
      logger.info("Messages prepended successfully");
    });
  });

  it("can set running state", async () => {
    await reporter.runTest("set running state", async () => {
      const { useChatStore } = await import("./chatStore");
      const store = useChatStore.getState();

      store.setIsRunning(true);
      expect(useChatStore.getState().isRunning).toBe(true);

      store.setIsRunning(false);
      expect(useChatStore.getState().isRunning).toBe(false);
      logger.info("Running state set correctly");
    });
  });
});

console.log("[Test] Chat Store tests loaded");
