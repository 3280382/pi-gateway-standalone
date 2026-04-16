/**
 * TopBar Component Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";

// Mock sidebar store
vi.mock("@/features/chat/stores/sidebarStore", () => ({
  useSidebarStore: vi.fn((selector) => {
    const state = {
      searchQuery: "",
      searchFilters: {
        user: true,
        assistant: true,
        system: true,
        thinking: true,
        tools: true,
        compaction: true,
        modelChange: true,
        thinkingLevelChange: true,
      },
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock session store
vi.mock("@/features/chat/stores/sessionStore", () => ({
  useSessionStore: vi.fn((selector) => {
    const state = {
      currentModel: null,
      thinkingLevel: "medium",
      setThinkingLevel: vi.fn(),
      setCurrentModel: vi.fn(),
      serverPid: null,
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock chat store
vi.mock("@/features/chat/stores/chatStore", () => ({
  useChatStore: vi.fn((selector) => {
    const state = {
      isStreaming: false,
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock sidebar api
vi.mock("@/services/api/sidebarApi", () => ({
  useSidebarController: vi.fn(() => ({
    setSearchQuery: vi.fn(),
    setSearchFilters: vi.fn(),
    changeWorkingDir: vi.fn(),
  })),
}));

// Mock websocket service
vi.mock("@/services/websocket.service", () => ({
  websocketService: {
    send: vi.fn(() => true),
  },
}));

describe("TopBar", () => {
  const defaultProps = {
    workingDir: "/home/user/project",
    connectionStatus: "connected" as const,
    pid: 12345,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input", () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByPlaceholderText("Search messages...")).toBeInTheDocument();
  });

  it("opens system prompt modal when document button clicked", () => {
    render(<TopBar {...defaultProps} />);
    const docBtn = screen.getByTitle("System Prompt");
    fireEvent.click(docBtn);
    // Modal should open
    expect(screen.getByText("System Prompt - /home/user/project")).toBeInTheDocument();
  });

  it("opens model selector when model button clicked", () => {
    render(<TopBar {...defaultProps} />);
    const modelBtn = screen.getByTitle("Select Model");
    fireEvent.click(modelBtn);
    // Dropdown should open
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("opens thinking level selector when thinking button clicked", () => {
    render(<TopBar {...defaultProps} />);
    const thinkBtn = screen.getByTitle("Thinking Level");
    fireEvent.click(thinkBtn);
    // Dropdown should show thinking levels
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("shows connected status", () => {
    render(<TopBar {...defaultProps} />);
    // Status element should have the connected class
    const statusElement = screen.getByTitle("connected (PID: 12345)");
    expect(statusElement).toBeInTheDocument();
  });

  it("shows filter toggle button", () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByTitle("Toggle Filters")).toBeInTheDocument();
  });
});
