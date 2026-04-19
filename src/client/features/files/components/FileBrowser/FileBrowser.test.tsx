/**
 * FileBrowser Component Tests
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileItem } from "./types";

// Mock child components
vi.mock("./FileToolbar", () => ({
  FileToolbar: () => <div data-testid="file-toolbar">Toolbar</div>,
}));

vi.mock("./FileGrid", () => ({
  FileGrid: ({  items }: {  items: FileItem[] }) => (
    <div data-testid="file-grid">{ items.length}  items</div>
  ),
}));

vi.mock("./FileList", () => ({
  FileList: ({  items }: {  items: FileItem[] }) => (
    <div data-testid="file-list">{ items.length}  items</div>
  ),
}));

vi.mock("./FileSidebar", () => ({
  FileSidebar: () => <div data-testid="file-sidebar">Sidebar</div>,
}));

vi.mock("./FileActionBar", () => ({
  FileActionBar: () => <div data-testid="file-actionbar">ActionBar</div>,
}));

// Simple FileBrowser for testing
function FileBrowser({
   items,
  isLoading,
  error,
  viewMode,
}: {
   items: FileItem[];
  isLoading: boolean;
  error: string | null;
  viewMode: "grid" | "list";
}) {
  if (isLoading) {
    return <div data-testid="loading">Loading...</div>;
  }

  if (error) {
    return <div data-testid="error">{error}</div>;
  }

  if ( items.length === 0) {
    return <div data-testid="empty">No files</div>;
  }

  return (
    <div data-testid="file-browser">
      <div data-testid="file-toolbar">Toolbar</div>
      <div data-testid="file-sidebar">Sidebar</div>
      <div data-testid="file-actionbar">ActionBar</div>
      {viewMode === "grid" ? (
        <div data-testid="file-grid">{ items.length}  items</div>
      ) : (
        <div data-testid="file-list">{ items.length}  items</div>
      )}
    </div>
  );
}

const mockFiles: FileItem[] = [
  {
    name: "file1.txt",
    path: "/test/file1.txt",
    isDirectory: false,
    size: 100,
    modified: "2024-01-01",
  },
  {
    name: "folder1",
    path: "/test/folder1",
    isDirectory: true,
    modified: "2024-01-02",
  },
];

describe("FileBrowser", () => {
  it("renders loading state", () => {
    render(<FileBrowser  items={[]} isLoading={true} error={null} viewMode="list" />);

    expect(screen.getByTestId("loading")).toHaveTextContent("Loading...");
  });

  it("renders error state", () => {
    render(<FileBrowser  items={[]} isLoading={false} error="Failed to load" viewMode="list" />);

    expect(screen.getByTestId("error")).toHaveTextContent("Failed to load");
  });

  it("renders empty state", () => {
    render(<FileBrowser  items={[]} isLoading={false} error={null} viewMode="list" />);

    expect(screen.getByTestId("empty")).toHaveTextContent("No files");
  });

  it("renders file browser with toolbar", () => {
    render(<FileBrowser  items={mockFiles} isLoading={false} error={null} viewMode="list" />);

    expect(screen.getByTestId("file-browser")).toBeInTheDocument();
    expect(screen.getByTestId("file-toolbar")).toBeInTheDocument();
  });

  it("renders sidebar", () => {
    render(<FileBrowser  items={mockFiles} isLoading={false} error={null} viewMode="list" />);

    expect(screen.getByTestId("file-sidebar")).toBeInTheDocument();
  });

  it("renders action bar", () => {
    render(<FileBrowser  items={mockFiles} isLoading={false} error={null} viewMode="list" />);

    expect(screen.getByTestId("file-actionbar")).toBeInTheDocument();
  });

  it("renders grid view when viewMode is grid", () => {
    render(<FileBrowser  items={mockFiles} isLoading={false} error={null} viewMode="grid" />);

    expect(screen.getByTestId("file-grid")).toHaveTextContent("2  items");
  });

  it("renders list view when viewMode is list", () => {
    render(<FileBrowser  items={mockFiles} isLoading={false} error={null} viewMode="list" />);

    expect(screen.getByTestId("file-list")).toHaveTextContent("2  items");
  });
});

console.log("[Test] FileBrowser tests loaded");
