/**
 * Sidebar API - Controller Unit Tests
 * Layer 2: API and Controller logic testing
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/services/client";
import { createSidebarController } from "./sidebarApi";

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Create a mock store with both state and actions
const createMockStore = () => ({
  // State
  workingDir: null,
  recentWorkspaces: [],
  sessions: [],
  searchQuery: "",
  searchFilters: {
    user: true,
    assistant: true,
    thinking: true,
    tools: true,
  },
  theme: "dark" as const,
  fontSize: "medium" as const,
  isLoading: false,
  error: null,
  selectedSessionId: null,

  // Actions
  setWorkingDir: vi.fn(),
  setRecentWorkspaces: vi.fn(),
  addRecentWorkspace: vi.fn(),
  setSessions: vi.fn(),
  setSearchQuery: vi.fn(),
  setSearchFilters: vi.fn(),
  setTheme: vi.fn(),
  setFontSize: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  selectSession: vi.fn(),
  clearError: vi.fn(),
  reset: vi.fn(),
});

// Mock Zustand store
vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: {
    getState: () => mockStore,
    setState: (updater: any) => {
      if (typeof updater === "function") {
        const newState = updater(mockStore);
        Object.assign(mockStore, newState);
      } else {
        Object.assign(mockStore, updater);
      }
    },
  },
}));

let mockStore: ReturnType<typeof createMockStore>;

// Mock WebSocket client
const mockSend = vi.fn();
const mockOn = vi.fn(() => vi.fn());

vi.mock("./client", () => ({
  fetchApi: vi.fn(),
  wsClient: {
    send: (...args: any[]) => mockSend(...args),
    on: (...args: any[]) => mockOn(...args),
  },
}));

describe("SidebarController", () => {
  beforeEach(() => {
    mockStore = createMockStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("loadWorkingDir", () => {
    it("should fetch and set working directory", async () => {
      const mockResponse = { cwd: "/test/project" };
      vi.mocked(client.fetchApi).mockResolvedValueOnce(mockResponse);

      const controller = createSidebarController();
      await controller.loadWorkingDir();

      expect(client.fetchApi).toHaveBeenCalledWith("/working-dir");
      expect(mockStore.setLoading).toHaveBeenCalledWith(true);
      expect(mockStore.setWorkingDir).toHaveBeenCalledWith("/test/project");
    });

    it("should handle API errors", async () => {
      const error = new Error("Network error");
      vi.mocked(client.fetchApi).mockRejectedValueOnce(error);

      const controller = createSidebarController();
      await controller.loadWorkingDir();

      expect(mockStore.setError).toHaveBeenCalledWith("Network error");
    });
  });

  describe("loadRecentWorkspaces", () => {
    it("should load from localStorage", async () => {
      const workspaces = ["/project1", "/project2"];
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(workspaces));

      const controller = createSidebarController();
      await controller.loadRecentWorkspaces();

      expect(localStorageMock.getItem).toHaveBeenCalledWith("recentWorkspaces");
      expect(mockStore.setRecentWorkspaces).toHaveBeenCalledWith(workspaces);
    });

    it("should handle empty localStorage", async () => {
      localStorageMock.getItem.mockReturnValueOnce(null);

      const controller = createSidebarController();
      await controller.loadRecentWorkspaces();

      expect(mockStore.setRecentWorkspaces).toHaveBeenCalledWith([]);
    });
  });

  describe("loadSessions", () => {
    it("should fetch and transform sessions", async () => {
      const mockResponse = {
        sessions: [
          {
            path: "/session1.json",
            firstMessage: "Hello World",
            messageCount: 5,
            modified: "2024-01-15T10:00:00Z",
          },
        ],
      };
      vi.mocked(client.fetchApi).mockResolvedValueOnce(mockResponse);

      const controller = createSidebarController();
      await controller.loadSessions("/test");

      expect(client.fetchApi).toHaveBeenCalledWith("/sessions?cwd=%2Ftest");
      expect(mockStore.setSessions).toHaveBeenCalled();
    });
  });

  describe("selectSession", () => {
    it("should update selected session and send websocket message", () => {
      const controller = createSidebarController();
      controller.selectSession("session-123");

      expect(mockStore.selectSession).toHaveBeenCalledWith("session-123");
      expect(mockSend).toHaveBeenCalledWith({
        type: "load_session",
        sessionPath: "session-123",
      });
    });
  });

  describe("setSearchQuery", () => {
    it("should update search query", () => {
      const controller = createSidebarController();
      controller.setSearchQuery("test query");

      expect(mockStore.setSearchQuery).toHaveBeenCalledWith("test query");
    });
  });

  describe("setTheme", () => {
    it("should update theme and apply to document", () => {
      document.body.className = "";

      const controller = createSidebarController();
      controller.setTheme("light");

      expect(mockStore.setTheme).toHaveBeenCalledWith("light");
      expect(document.body.classList.contains("light-mode")).toBe(true);
    });

    it("should remove light-mode class for dark theme", () => {
      document.body.classList.add("light-mode");

      const controller = createSidebarController();
      controller.setTheme("dark");

      expect(document.body.classList.contains("light-mode")).toBe(false);
    });
  });

  describe("setFontSize", () => {
    it("should update font size and apply to document", () => {
      document.body.className = "font-medium";

      const controller = createSidebarController();
      controller.setFontSize("large");

      expect(mockStore.setFontSize).toHaveBeenCalledWith("large");
      expect(document.body.classList.contains("font-large")).toBe(true);
      expect(document.body.classList.contains("font-medium")).toBe(false);
    });
  });

  describe("clearError", () => {
    it("should clear error state", () => {
      const controller = createSidebarController();
      controller.clearError();

      expect(mockStore.clearError).toHaveBeenCalled();
    });
  });
});
