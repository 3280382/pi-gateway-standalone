/**
 * Chat API Service Tests
 * Tests for chatApi service functions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestLogger, TestReporter } from "../../../../../../test/lib/test-utils";

const logger = new TestLogger("chat-api");
const reporter = new TestReporter("chat-api");

// Mock websocket service
vi.mock("@/services/websocket.service", () => ({
  websocketService: {
    isConnected: true,
    connect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(() => vi.fn()),
    send: vi.fn(),
  },
}));

// Mock chat websocket functions
vi.mock("@/features/chat/services/chatWebSocket", () => ({
  sendChatMessage: vi.fn().mockReturnValue(true),
  abortChatGeneration: vi.fn(),
  steerChat: vi.fn(),
  initChatWorkingDirectory: vi.fn(),
  setChatModel: vi.fn(),
  setChatThinkingLevel: vi.fn(),
  listChatModels: vi.fn(),
  executeChatCommand: vi.fn(),
  compactSession: vi.fn(),
  exportSession: vi.fn(),
  setChatLlmLogEnabled: vi.fn(),
  switchChatSession: vi.fn(),
  createNewChatSession: vi.fn(),
}));

// Create mock store functions
const createMockChatStore = () => ({
  addMessage: vi.fn(),
  clearInput: vi.fn(),
  startStreaming: vi.fn(),
  abortStreaming: vi.fn(),
  setInputText: vi.fn(),
  setMessages: vi.fn(),
  setSessionId: vi.fn(),
  toggleMessageCollapse: vi.fn(),
  toggleThinkingCollapse: vi.fn(),
  toggleToolsCollapse: vi.fn(),
  deleteMessage: vi.fn(),
  clearMessages: vi.fn(),
  regenerateMessage: vi.fn(),
  setShowThinking: vi.fn(),
  isStreaming: false,
});

let mockChatStore = createMockChatStore();

// Mock stores
vi.mock("@/features/chat/stores/chatStore", () => ({
  useChatStore: vi.fn(() => mockChatStore),
}));

const createMockSessionStore = () => ({
  setCurrentModel: vi.fn(),
  setThinkingLevel: vi.fn(),
  setWorkingDir: vi.fn(),
  setDefaultModel: vi.fn(),
  setResourceFiles: vi.fn(),
});

let mockSessionStore = createMockSessionStore();

vi.mock("@/features/chat/stores/sessionStore", () => ({
  useSessionStore: vi.fn(() => mockSessionStore),
}));

const createMockSidebarStore = () => ({
  setSessions: vi.fn(),
  setSelectedSessionId: vi.fn(),
  updateRuntimeStatusBulk: vi.fn(),
  setRuntimeStatus: vi.fn(),
});

let mockSidebarStore = createMockSidebarStore();

vi.mock("@/features/chat/stores/sidebarStore", () => ({
  useSidebarStore: vi.fn(() => mockSidebarStore),
}));

vi.mock("@/features/chat/services/sessionManager", () => ({
  sessionManager: {
    createNewSession: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/features/chat/services/messageReconstruction", () => ({
  messageReconstructor: {
    recordEvent: vi.fn(),
    reset: vi.fn(),
    startMessage: vi.fn(),
    endMessage: vi.fn(),
    autoFix: vi.fn(),
    shouldCreateMessageStart: vi.fn().mockReturnValue(false),
    shouldCreateContentBlockStart: vi.fn().mockReturnValue(false),
    startContentBlock: vi.fn(),
  },
  isContentDeltaEvent: vi.fn(),
  isContentStartEvent: vi.fn(),
  getContentTypeFromDelta: vi.fn(),
}));

describe("Chat API", () => {
  beforeEach(() => {
    logger.info("Resetting test state");
    vi.clearAllMocks();
    // Reset mock stores
    mockChatStore = createMockChatStore();
    mockSessionStore = createMockSessionStore();
    mockSidebarStore = createMockSidebarStore();
  });

  it("can initialize chat controller", async () => {
    await reporter.runTest("initialize chat controller", async () => {
      const { useChatController } = await import("./chatApi");
      const controller = useChatController();

      expect(controller).toBeDefined();
      expect(typeof controller.sendMessage).toBe("function");
      expect(typeof controller.abortGeneration).toBe("function");
      expect(typeof controller.setInputText).toBe("function");
      expect(typeof controller.clearInput).toBe("function");
      logger.info("Chat controller initialized successfully");
    });
  });

  it("can set input text", async () => {
    await reporter.runTest("set input text", async () => {
      const { useChatController } = await import("./chatApi");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.setInputText("Hello, AI!");

      const chatStore = useChatStore();
      expect(chatStore.setInputText).toHaveBeenCalledWith("Hello, AI!");
      logger.info("Input text set through controller");
    });
  });

  it("can clear input", async () => {
    await reporter.runTest("clear input", async () => {
      const { useChatController } = await import("./chatApi");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.clearInput();

      const chatStore = useChatStore();
      expect(chatStore.clearInput).toHaveBeenCalled();
      logger.info("Input cleared through controller");
    });
  });

  it("can toggle message collapse", async () => {
    await reporter.runTest("toggle message collapse", async () => {
      const { useChatController } = await import("./chatApi");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.toggleMessageCollapse("msg-123");

      const chatStore = useChatStore();
      expect(chatStore.toggleMessageCollapse).toHaveBeenCalledWith("msg-123");
      logger.info("Message collapse toggled");
    });
  });

  it("can toggle thinking collapse", async () => {
    await reporter.runTest("toggle thinking collapse", async () => {
      const { useChatController } = await import("./chatApi");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.toggleThinkingCollapse("msg-123");

      const chatStore = useChatStore();
      expect(chatStore.toggleThinkingCollapse).toHaveBeenCalledWith("msg-123");
      logger.info("Thinking collapse toggled");
    });
  });

  it("can toggle tools collapse", async () => {
    await reporter.runTest("toggle tools collapse", async () => {
      const { useChatController } = await import("./chatApi");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.toggleToolsCollapse("msg-123");

      const chatStore = useChatStore();
      expect(chatStore.toggleToolsCollapse).toHaveBeenCalledWith("msg-123");
      logger.info("Tools collapse toggled");
    });
  });

  it("can delete message", async () => {
    await reporter.runTest("delete message", async () => {
      const { useChatController } = await import("./chatApi");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.deleteMessage("msg-123");

      const chatStore = useChatStore();
      expect(chatStore.deleteMessage).toHaveBeenCalledWith("msg-123");
      logger.info("Message deleted");
    });
  });

  it("can clear messages", async () => {
    await reporter.runTest("clear messages", async () => {
      const { useChatController } = await import("./chatApi");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.clearMessages();

      const chatStore = useChatStore();
      expect(chatStore.clearMessages).toHaveBeenCalled();
      logger.info("Messages cleared");
    });
  });

  it("can regenerate message", async () => {
    await reporter.runTest("regenerate message", async () => {
      const { useChatController } = await import("./chatApi");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.regenerateMessage("msg-123");

      const chatStore = useChatStore();
      expect(chatStore.regenerateMessage).toHaveBeenCalledWith("msg-123");
      logger.info("Message regeneration triggered");
    });
  });

  it("can set show thinking", async () => {
    await reporter.runTest("set show thinking", async () => {
      const { useChatController } = await import("./chatApi");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.setShowThinking(false);

      const chatStore = useChatStore();
      expect(chatStore.setShowThinking).toHaveBeenCalledWith(false);
      logger.info("Show thinking set");
    });
  });

  it("can abort generation", async () => {
    await reporter.runTest("abort generation", async () => {
      const { useChatController } = await import("./chatApi");
      const { abortChatGeneration } = await import("@/features/chat/services/chatWebSocket");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.abortGeneration();

      expect(abortChatGeneration).toHaveBeenCalled();
      const chatStore = useChatStore();
      expect(chatStore.abortStreaming).toHaveBeenCalled();
      logger.info("Generation aborted");
    });
  });

  it("can steer chat", async () => {
    await reporter.runTest("steer chat", async () => {
      const { useChatController } = await import("./chatApi");
      const { steerChat } = await import("@/features/chat/services/chatWebSocket");
      const { useChatStore } = await import("@/features/chat/stores/chatStore");

      const controller = useChatController();
      controller.steer("Please continue");

      const chatStore = useChatStore();
      expect(chatStore.addMessage).toHaveBeenCalled();
      expect(chatStore.clearInput).toHaveBeenCalled();
      expect(steerChat).toHaveBeenCalledWith("Please continue");
      logger.info("Chat steered");
    });
  });

  it("steer does nothing with empty text", async () => {
    await reporter.runTest("steer with empty text", async () => {
      const { useChatController } = await import("./chatApi");
      const { steerChat } = await import("@/features/chat/services/chatWebSocket");

      const controller = useChatController();
      controller.steer("   ");

      expect(steerChat).not.toHaveBeenCalled();
      logger.info("Steer correctly ignores empty text");
    });
  });

  it("has expand/collapse tool output methods", async () => {
    await reporter.runTest("tool output methods exist", async () => {
      const { useChatController } = await import("./chatApi");

      const controller = useChatController();

      // These are placeholder methods
      expect(typeof controller.expandToolOutput).toBe("function");
      expect(typeof controller.collapseToolOutput).toBe("function");

      // Should not throw
      expect(() => controller.expandToolOutput("tool-1")).not.toThrow();
      expect(() => controller.collapseToolOutput("tool-1")).not.toThrow();

      logger.info("Tool output methods available");
    });
  });
});

console.log("[Test] Chat API tests loaded");
