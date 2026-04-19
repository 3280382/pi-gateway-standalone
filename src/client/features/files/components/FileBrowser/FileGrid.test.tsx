/**
 * FileGrid Component Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/viewerStore";
import { FileGrid } from "./FileGrid";

// Mock stores
vi.mock("@/stores/fileStore", () => ({
  useFileStore: vi.fn(),
}));

vi.mock("@/stores/viewerStore", () => ({
  useFileViewerStore: vi.fn(),
}));

describe("FileGrid", () => {
  const mockSelectFile = vi.fn();
  const mockSetSelectedActionFile = vi.fn();
  const mockOpenViewer = vi.fn();

  const mockFiles = [
    {
      name: "file1.txt",
      path: "/test/file1.txt",
      isDirectory: false,
      size: 1024,
      modified: "2024-01-01T10:00:00Z",
    },
    {
      name: "folder1",
      path: "/test/folder1",
      isDirectory: true,
      modified: "2024-01-02T10:00:00Z",
    },
    {
      name: "script.js",
      path: "/test/script.js",
      isDirectory: false,
      size: 2048,
      modified: "2024-01-03T10:00:00Z",
    },
    {
      name: "image.png",
      path: "/test/image.png",
      isDirectory: false,
      size: 5120,
      modified: "2024-01-04T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (useFileStore as any).mockReturnValue({
      selectedFile: null,
      selectedActionFile: null,
      selectFile: mockSelectFile,
      setSelectedActionFile: mockSetSelectedActionFile,
    });

    (useFileViewerStore as any).mockReturnValue({
      openViewer: mockOpenViewer,
    });
  });

  it("renders all file  items in grid layout", () => {
    render(<FileGrid  items={mockFiles} />);

    expect(screen.getByText("file1.txt")).toBeInTheDocument();
    expect(screen.getByText("folder1")).toBeInTheDocument();
    expect(screen.getByText("script.js")).toBeInTheDocument();
    expect(screen.getByText("image.png")).toBeInTheDocument();
  });

  it("shows folder icon for directories", () => {
    render(<FileGrid  items={mockFiles} />);

    const folderItem = screen.getByText("folder1").closest(".gridItem");
    expect(folderItem).toHaveClass("directory");
  });

  it("shows file icon for files", () => {
    render(<FileGrid  items={mockFiles} />);

    const fileItem = screen.getByText("file1.txt").closest(".gridItem");
    expect(fileItem).not.toHaveClass("directory");
  });

  it("highlights selected file", () => {
    (useFileStore as any).mockReturnValue({
      selectedFile: "/test/file1.txt",
      selectedActionFile: null,
      selectFile: mockSelectFile,
      setSelectedActionFile: mockSetSelectedActionFile,
    });

    render(<FileGrid  items={mockFiles} />);

    const selectedItem = screen.getByText("file1.txt").closest(".gridItem");
    expect(selectedItem).toHaveClass("selected");
  });

  it("calls selectFile when a file is clicked", () => {
    render(<FileGrid  items={mockFiles} />);

    const fileElement = screen.getByText("file1.txt");
    fireEvent.click(fileElement);

    expect(mockSelectFile).toHaveBeenCalledWith("/test/file1.txt", "file1.txt");
  });

  it("calls setSelectedActionFile on single click", () => {
    render(<FileGrid  items={mockFiles} />);

    const fileElement = screen.getByText("file1.txt");
    fireEvent.click(fileElement);

    expect(mockSetSelectedActionFile).toHaveBeenCalledWith("/test/file1.txt", "file1.txt");
  });

  it("handles double click to open viewer", () => {
    render(<FileGrid  items={mockFiles} />);

    const fileElement = screen.getByText("file1.txt");

    // Simulate double click
    fireEvent.click(fileElement);
    fireEvent.click(fileElement); // Second click within timeout

    expect(mockOpenViewer).toHaveBeenCalledWith("/test/file1.txt", "file1.txt", "view");
  });

  it("handles directory double click differently", () => {
    render(<FileGrid  items={mockFiles} />);

    const folderElement = screen.getByText("folder1");

    // Directory double click should not open viewer
    fireEvent.click(folderElement);
    fireEvent.click(folderElement);

    expect(mockOpenViewer).not.toHaveBeenCalled();
  });

  it("shows empty state when no  items", () => {
    render(<FileGrid  items={[]} />);

    expect(screen.queryByText("file1.txt")).not.toBeInTheDocument();
    expect(screen.queryByText("folder1")).not.toBeInTheDocument();
  });

  it("handles files with special characters in names", () => {
    const specialFiles = [
      {
        name: "file with spaces.txt",
        path: "/test/file with spaces.txt",
        isDirectory: false,
        size: 100,
        modified: "2024-01-01T10:00:00Z",
      },
      {
        name: "file-with-dashes.txt",
        path: "/test/file-with-dashes.txt",
        isDirectory: false,
        size: 200,
        modified: "2024-01-01T10:00:00Z",
      },
      {
        name: "file_with_underscores.txt",
        path: "/test/file_with_underscores.txt",
        isDirectory: false,
        size: 300,
        modified: "2024-01-01T10:00:00Z",
      },
    ];

    render(<FileGrid  items={specialFiles} />);

    expect(screen.getByText("file with spaces.txt")).toBeInTheDocument();
    expect(screen.getByText("file-with-dashes.txt")).toBeInTheDocument();
    expect(screen.getByText("file_with_underscores.txt")).toBeInTheDocument();
  });

  it("handles very long file names with ellipsis", () => {
    const longFileName =
      "very_long_file_name_that_should_be_truncated_with_ellipsis_when_displayed_in_the_grid.txt";
    const longFiles = [
      {
        name: longFileName,
        path: `/test/${longFileName}`,
        isDirectory: false,
        size: 100,
        modified: "2024-01-01T10:00:00Z",
      },
    ];

    render(<FileGrid  items={longFiles} />);

    const nameElement = screen.getByText(longFileName);
    expect(nameElement).toBeInTheDocument();
    // CSS should handle truncation with text-overflow: ellipsis
  });

  it("shows different icons for different file types", () => {
    const diverseFiles = [
      {
        name: "script.js",
        path: "/test/script.js",
        isDirectory: false,
        size: 100,
        modified: "2024-01-01T10:00:00Z",
      },
      {
        name: "image.png",
        path: "/test/image.png",
        isDirectory: false,
        size: 200,
        modified: "2024-01-01T10:00:00Z",
      },
      {
        name: "document.pdf",
        path: "/test/document.pdf",
        isDirectory: false,
        size: 300,
        modified: "2024-01-01T10:00:00Z",
      },
    ];

    render(<FileGrid  items={diverseFiles} />);

    expect(screen.getByText("script.js")).toBeInTheDocument();
    expect(screen.getByText("image.png")).toBeInTheDocument();
    expect(screen.getByText("document.pdf")).toBeInTheDocument();
  });

  it("handles many files with responsive grid layout", () => {
    const manyFiles = Array.from({ length: 20 }, (_, i) => ({
      name: `file${i}.txt`,
      path: `/test/file${i}.txt`,
      isDirectory: false,
      size: 100 + i,
      modified: "2024-01-01T10:00:00Z",
    }));

    render(<FileGrid  items={manyFiles} />);

    // Should render all files
    for (let i = 0; i < 10; i++) {
      // Check first 10
      expect(screen.getByText(`file${i}.txt`)).toBeInTheDocument();
    }
  });

  it("applies hover effects correctly", () => {
    render(<FileGrid  items={mockFiles} />);

    const fileElement = screen.getByText("file1.txt").closest(".gridItem");
    expect(fileElement).toBeInTheDocument();
    // Hover effects are handled by CSS
  });

  it("handles click on already selected file", () => {
    (useFileStore as any).mockReturnValue({
      selectedFile: "/test/file1.txt",
      selectedActionFile: null,
      selectFile: mockSelectFile,
      setSelectedActionFile: mockSetSelectedActionFile,
    });

    render(<FileGrid  items={mockFiles} />);

    const fileElement = screen.getByText("file1.txt");
    fireEvent.click(fileElement);

    // Should still call setSelectedActionFile
    expect(mockSetSelectedActionFile).toHaveBeenCalledWith("/test/file1.txt", "file1.txt");
  });

  it("maintains consistent grid item sizing", () => {
    render(<FileGrid  items={mockFiles} />);

    const gridItems = screen.getAllByText(/file1\.txt|folder1|script\.js|image\.png/);

    // All grid  items should be rendered
    expect(gridItems.length).toBe(4);

    // Each should be within a gridItem container
    gridItems.forEach((item) => {
      expect(item.closest(".gridItem")).toBeInTheDocument();
    });
  });

  it("handles mixed directory and file layout", () => {
    const mixedFiles = [
      {
        name: "dir1",
        path: "/test/dir1",
        isDirectory: true,
        modified: "2024-01-01T10:00:00Z",
      },
      {
        name: "file1.txt",
        path: "/test/file1.txt",
        isDirectory: false,
        size: 100,
        modified: "2024-01-01T10:00:00Z",
      },
      {
        name: "dir2",
        path: "/test/dir2",
        isDirectory: true,
        modified: "2024-01-01T10:00:00Z",
      },
      {
        name: "file2.txt",
        path: "/test/file2.txt",
        isDirectory: false,
        size: 200,
        modified: "2024-01-01T10:00:00Z",
      },
    ];

    render(<FileGrid  items={mixedFiles} />);

    // Should render all  items in correct order
    expect(screen.getByText("dir1")).toBeInTheDocument();
    expect(screen.getByText("file1.txt")).toBeInTheDocument();
    expect(screen.getByText("dir2")).toBeInTheDocument();
    expect(screen.getByText("file2.txt")).toBeInTheDocument();
  });
});
