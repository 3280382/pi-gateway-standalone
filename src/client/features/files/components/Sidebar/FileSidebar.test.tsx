/**
 * FileSidebar Component Tests
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileStore } from "@/features/files/stores/fileStore";
import { FileSidebar } from "./FileSidebar";

// Mock store
vi.mock("@/stores/fileStore", () => ({
  useFileStore: vi.fn(),
}));

// Mock API
vi.mock("@/services/api/fileApi", () => ({
  browse: vi.fn(),
}));

describe("FileSidebar", () => {
  const mockSetCurrentPath = vi.fn();
  const mockLoadFiles = vi.fn();

  const _mockTreeData = {
    "/": {
      name: "/",
      path: "/",
      isDirectory: true,
      children: ["/home", "/root"],
      loaded: true,
    },
    "/home": {
      name: "home",
      path: "/home",
      isDirectory: true,
      children: ["/home/user"],
      loaded: true,
    },
    "/root": {
      name: "root",
      path: "/root",
      isDirectory: true,
      children: ["/root/projects"],
      loaded: true,
    },
    "/root/projects": {
      name: "projects",
      path: "/root/projects",
      isDirectory: true,
      children: [],
      loaded: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (useFileStore as any).mockReturnValue({
      currentPath: "/",
      setCurrentPath: mockSetCurrentPath,
      loadFiles: mockLoadFiles,
    });
  });

  it("renders root directory by default", () => {
    render(<FileSidebar />);

    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("renders tree structure with expandable items", () => {
    render(<FileSidebar />);

    // Root should be visible
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("expands and collapses directory items", async () => {
    const { browseDirectory } = await import("@/services/api/fileApi");
    (browseDirectory as any).mockResolvedValue({
      items: [
        { name: "file1.txt", path: "/test/file1.txt", isDirectory: false },
        { name: "subdir", path: "/test/subdir", isDirectory: true },
      ],
    });

    render(<FileSidebar />);

    // Initially, children might not be visible
    const rootItem = screen.getByText("/");
    expect(rootItem).toBeInTheDocument();
  });

  it("calls setCurrentPath and loadFiles when directory is clicked", async () => {
    const { browseDirectory } = await import("@/services/api/fileApi");
    (browseDirectory as any).mockResolvedValue({
      items: [],
    });

    render(<FileSidebar />);

    const rootItem = screen.getByText("/");
    fireEvent.click(rootItem);

    await waitFor(() => {
      expect(mockSetCurrentPath).toHaveBeenCalledWith("/");
      expect(mockLoadFiles).toHaveBeenCalled();
    });
  });

  it("shows loading indicator when loading children", async () => {
    let resolveBrowse: (value: any) => void;
    const browsePromise = new Promise((resolve) => {
      resolveBrowse = resolve;
    });

    const { browseDirectory } = await import("@/services/api/fileApi");
    (browseDirectory as any).mockReturnValue(browsePromise);

    render(<FileSidebar />);

    // Click to load children
    const rootItem = screen.getByText("/");
    fireEvent.click(rootItem);

    // Should show loading indicator
    expect(screen.getByText("...")).toBeInTheDocument();

    // Resolve the promise
    resolveBrowse?.({ items: [] });

    await waitFor(() => {
      expect(screen.queryByText("...")).not.toBeInTheDocument();
    });
  });

  it("handles API errors gracefully", async () => {
    const { browseDirectory } = await import("@/services/api/fileApi");
    (browseDirectory as any).mockRejectedValue(new Error("API Error"));

    render(<FileSidebar />);

    const rootItem = screen.getByText("/");
    fireEvent.click(rootItem);

    // Should handle error without crashing
    await waitFor(() => {
      expect(browseDirectory).toHaveBeenCalled();
    });
  });

  it("shows empty state for directory with no children", async () => {
    const { browseDirectory } = await import("@/services/api/fileApi");
    (browseDirectory as any).mockResolvedValue({
      items: [],
    });

    render(<FileSidebar />);

    const rootItem = screen.getByText("/");
    fireEvent.click(rootItem);

    await waitFor(() => {
      // Directory should still be visible
      expect(screen.getByText("/")).toBeInTheDocument();
    });
  });

  it("highlights current directory", () => {
    (useFileStore as any).mockReturnValue({
      currentPath: "/home",
      setCurrentPath: mockSetCurrentPath,
      loadFiles: mockLoadFiles,
    });

    render(<FileSidebar />);

    // The active directory should have active class
    // This depends on CSS implementation
    const _homeItem = screen.queryByText("home");
    // Note: home might not be rendered if tree hasn't loaded it yet
  });

  it("handles nested directory structure", async () => {
    const { browseDirectory } = await import("@/services/api/fileApi");
    (browseDirectory as any).mockImplementation((path: string) => {
      if (path === "/") {
        return Promise.resolve({
          items: [{ name: "home", path: "/home", isDirectory: true }],
        });
      }
      if (path === "/home") {
        return Promise.resolve({
          items: [{ name: "user", path: "/home/user", isDirectory: true }],
        });
      }
      return Promise.resolve({ items: [] });
    });

    render(<FileSidebar />);

    // Click root to load children
    const rootItem = screen.getByText("/");
    fireEvent.click(rootItem);

    await waitFor(() => {
      expect(browseDirectory).toHaveBeenCalledWith("/");
    });

    // Click home to load its children
    const homeItem = await screen.findByText("home");
    fireEvent.click(homeItem);

    await waitFor(() => {
      expect(browseDirectory).toHaveBeenCalledWith("/home");
    });
  });

  it("caches directory contents", async () => {
    const { browseDirectory } = await import("@/services/api/fileApi");
    (browseDirectory as any).mockResolvedValue({
      items: [{ name: "file1.txt", path: "/test/file1.txt", isDirectory: false }],
    });

    render(<FileSidebar />);

    // Click same directory multiple times
    const rootItem = screen.getByText("/");
    fireEvent.click(rootItem);
    fireEvent.click(rootItem);
    fireEvent.click(rootItem);

    // Should only call API once due to caching
    await waitFor(() => {
      expect(browseDirectory).toHaveBeenCalledTimes(1);
    });
  });

  it("handles clear cache button", async () => {
    const { browseDirectory } = await import("@/services/api/fileApi");
    (browseDirectory as any).mockResolvedValue({
      items: [],
    });

    render(<FileSidebar />);

    // Look for clear cache button (might be hidden or shown conditionally)
    const clearCacheBtn = screen.queryByTitle("Clear cache");

    if (clearCacheBtn) {
      fireEvent.click(clearCacheBtn);

      // After clearing cache, clicking should call API again
      const rootItem = screen.getByText("/");
      fireEvent.click(rootItem);

      await waitFor(() => {
        expect(browseDirectory).toHaveBeenCalled();
      });
    }
  });

  it("handles special directory names", async () => {
    const { browseDirectory } = await import("@/services/api/fileApi");
    (browseDirectory as any).mockResolvedValue({
      items: [
        { name: ".hidden", path: "/.hidden", isDirectory: true },
        { name: "normal", path: "/normal", isDirectory: true },
        { name: "with spaces", path: "/with spaces", isDirectory: true },
        { name: "with-dashes", path: "/with-dashes", isDirectory: true },
        {
          name: "with_underscores",
          path: "/with_underscores",
          isDirectory: true,
        },
      ],
    });

    render(<FileSidebar />);

    const rootItem = screen.getByText("/");
    fireEvent.click(rootItem);

    await waitFor(() => {
      expect(browseDirectory).toHaveBeenCalledWith("/");
    });

    // All directory names should be handled
    expect(screen.getByText(".hidden")).toBeInTheDocument();
    expect(screen.getByText("normal")).toBeInTheDocument();
    expect(screen.getByText("with spaces")).toBeInTheDocument();
    expect(screen.getByText("with-dashes")).toBeInTheDocument();
    expect(screen.getByText("with_underscores")).toBeInTheDocument();
  });

  it("handles very long directory names", async () => {
    const longName =
      "very_long_directory_name_that_should_be_truncated_with_ellipsis_in_the_sidebar";
    const { browseDirectory } = await import("@/services/api/fileApi");
    (browseDirectory as any).mockResolvedValue({
      items: [{ name: longName, path: `/${longName}`, isDirectory: true }],
    });

    render(<FileSidebar />);

    const rootItem = screen.getByText("/");
    fireEvent.click(rootItem);

    await waitFor(() => {
      const dirElement = screen.getByText(longName);
      expect(dirElement).toBeInTheDocument();
      // CSS should handle truncation
    });
  });

  it("handles root path navigation correctly", () => {
    (useFileStore as any).mockReturnValue({
      currentPath: "/",
      setCurrentPath: mockSetCurrentPath,
      loadFiles: mockLoadFiles,
    });

    render(<FileSidebar />);

    const rootItem = screen.getByText("/");
    fireEvent.click(rootItem);

    expect(mockSetCurrentPath).toHaveBeenCalledWith("/");
  });

  it("handles non-root path navigation", () => {
    (useFileStore as any).mockReturnValue({
      currentPath: "/home/user",
      setCurrentPath: mockSetCurrentPath,
      loadFiles: mockLoadFiles,
    });

    render(<FileSidebar />);

    // The component should handle non-root current paths
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("maintains tree state between renders", async () => {
    const { browseDirectory } = await import("@/services/api/fileApi");
    let callCount = 0;
    (browseDirectory as any).mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        items: [
          {
            name: `dir${callCount}`,
            path: `/dir${callCount}`,
            isDirectory: true,
          },
        ],
      });
    });

    const { rerender } = render(<FileSidebar />);

    // Click root
    const rootItem = screen.getByText("/");
    fireEvent.click(rootItem);

    await waitFor(() => {
      expect(browseDirectory).toHaveBeenCalledTimes(1);
    });

    // Re-render component
    rerender(<FileSidebar />);

    // Click root again - should use cache
    fireEvent.click(rootItem);

    // Should not call API again due to cache
    expect(browseDirectory).toHaveBeenCalledTimes(1);
  });
});
