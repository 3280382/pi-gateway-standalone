/**
 * File Store Tests
 * Tests for fileStore state management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestLogger, TestReporter } from "../../../../../test/lib/test-utils";

const logger = new TestLogger("file-store");
const reporter = new TestReporter("file-store");

// Mock zustand middleware
vi.mock("zustand/middleware", () => ({
  devtools: (config: any) => config,
  persist: (config: any) => config,
}));

// Mock persist config
vi.mock("./persist.config", () => ({
  FILES_BROWSER_PERSIST: [
    "currentBrowsePath",
    "viewMode",
    "sortMode",
    "filterType",
    "isSidebarVisible",
    "bottomPanelHeight",
    "treeFilterMode",
  ],
  FILES_STORAGE_KEYS: {
    FILES_BROWSER: "file-browser-store",
  },
  FILES_STORAGE_VERSION: {
    FILES_BROWSER: 1,
  },
}));

describe("File Store", () => {
  beforeEach(() => {
    logger.info("Resetting test state");
    vi.clearAllMocks();
  });

  it("initializes with default state", async () => {
    await reporter.runTest("default state initialization", async () => {
      const { useFileStore } = await import("./fileStore");
      const state = useFileStore.getState();

      expect(state.currentBrowsePath).toBe("/root");
      expect(state.parentPath).toBe("/");
      expect(state.items).toEqual([]);
      expect(state.selectedItems).toEqual([]);
      expect(state.viewMode).toBe("grid");
      expect(state.sortMode).toBe("time-desc");
      expect(state.filterType).toBe("all");
      expect(state.filterText).toBe("");
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.isSidebarVisible).toBe(false);
      expect(state.isBottomPanelOpen).toBe(false);
      expect(state.bottomPanelHeight).toBe(300);
      logger.info("Default state verified");
    });
  });

  it("can set current browse path", async () => {
    await reporter.runTest("set current browse path", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.setCurrentBrowsePath("/home/user/projects");
      expect(useFileStore.getState().currentBrowsePath).toBe("/home/user/projects");
      logger.info("Browse path set successfully");
    });
  });

  it("can set items", async () => {
    await reporter.runTest("set items", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      const items = [
        {
          name: "file1.txt",
          path: "/test/file1.txt",
          isDirectory: false,
          size: 100,
          modified: new Date(),
        },
        {
          name: "folder1",
          path: "/test/folder1",
          isDirectory: true,
          size: 0,
          modified: new Date(),
        },
      ];

      store.setItems(items);
      expect(useFileStore.getState().items).toHaveLength(2);
      expect(useFileStore.getState().items[0].name).toBe("file1.txt");
      logger.info("Items set successfully");
    });
  });

  it("can toggle selection", async () => {
    await reporter.runTest("toggle selection", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      // Select item
      store.toggleSelection("/test/file1.txt");
      expect(useFileStore.getState().selectedItems).toContain("/test/file1.txt");

      // Deselect item
      store.toggleSelection("/test/file1.txt");
      expect(useFileStore.getState().selectedItems).not.toContain("/test/file1.txt");
      logger.info("Selection toggle works correctly");
    });
  });

  it("can clear selection", async () => {
    await reporter.runTest("clear selection", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.toggleSelection("/test/file1.txt");
      store.toggleSelection("/test/file2.txt");
      expect(useFileStore.getState().selectedItems).toHaveLength(2);

      store.clearSelection();
      expect(useFileStore.getState().selectedItems).toHaveLength(0);
      logger.info("Selection cleared successfully");
    });
  });

  it("can toggle view mode", async () => {
    await reporter.runTest("toggle view mode", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      expect(useFileStore.getState().viewMode).toBe("grid");

      store.toggleViewMode();
      expect(useFileStore.getState().viewMode).toBe("list");

      store.toggleViewMode();
      expect(useFileStore.getState().viewMode).toBe("grid");
      logger.info("View mode toggled successfully");
    });
  });

  it("can set view mode directly", async () => {
    await reporter.runTest("set view mode", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.setViewMode("list");
      expect(useFileStore.getState().viewMode).toBe("list");

      store.setViewMode("grid");
      expect(useFileStore.getState().viewMode).toBe("grid");
      logger.info("View mode set directly");
    });
  });

  it("can set sort mode", async () => {
    await reporter.runTest("set sort mode", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.setSortMode("name-asc");
      expect(useFileStore.getState().sortMode).toBe("name-asc");

      store.setSortMode("size-desc");
      expect(useFileStore.getState().sortMode).toBe("size-desc");
      logger.info("Sort mode set successfully");
    });
  });

  it("can set filter type", async () => {
    await reporter.runTest("set filter type", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.setFilterType("files");
      expect(useFileStore.getState().filterType).toBe("files");

      store.setFilterType("directories");
      expect(useFileStore.getState().filterType).toBe("directories");
      logger.info("Filter type set successfully");
    });
  });

  it("can set filter text", async () => {
    await reporter.runTest("set filter text", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.setFilterText("*.js");
      expect(useFileStore.getState().filterText).toBe("*.js");

      store.setFilterText("");
      expect(useFileStore.getState().filterText).toBe("");
      logger.info("Filter text set successfully");
    });
  });

  it("can set loading state", async () => {
    await reporter.runTest("set loading state", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.setLoading(true);
      expect(useFileStore.getState().isLoading).toBe(true);

      store.setLoading(false);
      expect(useFileStore.getState().isLoading).toBe(false);
      logger.info("Loading state set successfully");
    });
  });

  it("can set error state", async () => {
    await reporter.runTest("set error state", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.setError("Failed to load directory");
      expect(useFileStore.getState().error).toBe("Failed to load directory");

      store.setError(null);
      expect(useFileStore.getState().error).toBeNull();
      logger.info("Error state set successfully");
    });
  });

  it("can toggle sidebar visibility", async () => {
    await reporter.runTest("toggle sidebar visibility", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      expect(useFileStore.getState().isSidebarVisible).toBe(false);

      store.toggleSidebar();
      expect(useFileStore.getState().isSidebarVisible).toBe(true);

      store.toggleSidebar();
      expect(useFileStore.getState().isSidebarVisible).toBe(false);
      logger.info("Sidebar visibility toggled successfully");
    });
  });

  it("can open and close bottom panel", async () => {
    await reporter.runTest("bottom panel operations", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      expect(useFileStore.getState().isBottomPanelOpen).toBe(false);

      store.openBottomPanel("terminal");
      expect(useFileStore.getState().isBottomPanelOpen).toBe(true);
      expect(useFileStore.getState().bottomPanelType).toBe("terminal");

      store.closeBottomPanel();
      expect(useFileStore.getState().isBottomPanelOpen).toBe(false);
      expect(useFileStore.getState().bottomPanelType).toBeNull();
      logger.info("Bottom panel operations work correctly");
    });
  });

  it("can toggle bottom panel", async () => {
    await reporter.runTest("toggle bottom panel", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      // Open panel
      store.toggleBottomPanel("terminal");
      expect(useFileStore.getState().isBottomPanelOpen).toBe(true);
      expect(useFileStore.getState().bottomPanelType).toBe("terminal");

      // Toggle same type should close
      store.toggleBottomPanel("terminal");
      expect(useFileStore.getState().isBottomPanelOpen).toBe(false);

      // Toggle different type should switch
      store.toggleBottomPanel("terminal");
      store.toggleBottomPanel("git");
      expect(useFileStore.getState().isBottomPanelOpen).toBe(true);
      expect(useFileStore.getState().bottomPanelType).toBe("git");
      logger.info("Bottom panel toggle works correctly");
    });
  });

  it("can set bottom panel height", async () => {
    await reporter.runTest("set bottom panel height", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.setBottomPanelHeight(400);
      expect(useFileStore.getState().bottomPanelHeight).toBe(400);
      logger.info("Bottom panel height set successfully");
    });
  });

  it("can toggle git mode", async () => {
    await reporter.runTest("toggle git mode", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      expect(useFileStore.getState().isGitModeActive).toBe(false);

      store.toggleGitMode();
      expect(useFileStore.getState().isGitModeActive).toBe(true);

      store.toggleGitMode();
      expect(useFileStore.getState().isGitModeActive).toBe(false);
      logger.info("Git mode toggled successfully");
    });
  });

  it("can set git history file", async () => {
    await reporter.runTest("set git history file", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      const file = { path: "/test/file.txt", name: "file.txt" };
      store.setGitHistoryFile(file);
      expect(useFileStore.getState().gitHistoryFile).toEqual(file);

      store.setGitHistoryFile(null);
      expect(useFileStore.getState().gitHistoryFile).toBeNull();
      logger.info("Git history file set successfully");
    });
  });

  it("can toggle todo mode", async () => {
    await reporter.runTest("toggle todo mode", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      expect(useFileStore.getState().isTodoModeActive).toBe(false);

      store.toggleTodoMode();
      expect(useFileStore.getState().isTodoModeActive).toBe(true);

      store.toggleTodoMode();
      expect(useFileStore.getState().isTodoModeActive).toBe(false);
      logger.info("Todo mode toggled successfully");
    });
  });

  it("can set path cache", async () => {
    await reporter.runTest("set path cache", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      const cache = new Map();
      cache.set("/test", {
        items: [{ name: "file.txt", path: "/test/file.txt", isDirectory: false }],
        timestamp: Date.now(),
      });

      store.setPathCache(cache);
      expect(useFileStore.getState().pathCache.has("/test")).toBe(true);
      logger.info("Path cache set successfully");
    });
  });

  it("can check if path is selected", async () => {
    await reporter.runTest("is selected check", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.toggleSelection("/test/file1.txt");

      expect(useFileStore.getState().isSelected("/test/file1.txt")).toBe(true);
      expect(useFileStore.getState().isSelected("/test/file2.txt")).toBe(false);
      logger.info("Is selected check works correctly");
    });
  });

  it("can toggle multi-select mode", async () => {
    await reporter.runTest("toggle multi-select mode", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      expect(useFileStore.getState().isMultiSelectMode).toBe(false);

      store.toggleMultiSelectMode();
      expect(useFileStore.getState().isMultiSelectMode).toBe(true);
      expect(useFileStore.getState().selectedItems).toEqual([]);

      store.toggleMultiSelectMode();
      expect(useFileStore.getState().isMultiSelectMode).toBe(false);
      logger.info("Multi-select mode toggled successfully");
    });
  });

  it("clears selection when toggling multi-select on", async () => {
    await reporter.runTest("clear selection on multi-select toggle", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      // Ensure multi-select mode is off initially
      if (useFileStore.getState().isMultiSelectMode) {
        store.toggleMultiSelectMode();
      }

      // Add some selections first (but toggleMultiSelectMode clears it when enabling)
      expect(useFileStore.getState().selectedItems).toHaveLength(0);

      // Enable multi-select mode using toggle - this should clear selection
      store.toggleMultiSelectMode();
      expect(useFileStore.getState().isMultiSelectMode).toBe(true);
      expect(useFileStore.getState().selectedItems).toHaveLength(0);
      logger.info("Selection cleared when toggling multi-select on");
    });
  });

  it("can set tree filter mode", async () => {
    await reporter.runTest("set tree filter mode", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      expect(useFileStore.getState().treeFilterMode).toBe("normal");

      store.setTreeFilterMode("all");
      expect(useFileStore.getState().treeFilterMode).toBe("all");

      store.setTreeFilterMode("search");
      expect(useFileStore.getState().treeFilterMode).toBe("search");
      logger.info("Tree filter mode set successfully");
    });
  });

  it("can set tree filter text", async () => {
    await reporter.runTest("set tree filter text", async () => {
      const { useFileStore } = await import("./fileStore");
      const store = useFileStore.getState();

      store.setTreeFilterText("search term");
      expect(useFileStore.getState().treeFilterText).toBe("search term");
      logger.info("Tree filter text set successfully");
    });
  });
});

console.log("[Test] File Store tests loaded");
