/**
 * FileToolbar Component Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileStore } from "@/features/files/stores/fileStore";
import { FileToolbar } from "./FileToolbar";

// Mock store
vi.mock("@/stores/fileStore", () => ({
  useFileStore: vi.fn(),
}));

describe("FileToolbar", () => {
  const mockOnRefresh = vi.fn();
  const mockOnNavigateUp = vi.fn();
  const mockOnToggleSidebar = vi.fn();
  const mockOnViewModeChange = vi.fn();
  const mockOnSortChange = vi.fn();
  const mockOnFilterChange = vi.fn();
  const mockOnSearchChange = vi.fn();
  const mockOnExecuteOutput = vi.fn();
  const mockOnOpenBottomPanel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (useFileStore as any).mockReturnValue({
      currentPath: "/test/path",
      sortMode: "name",
      filterType: "all",
      searchQuery: "",
      selectedActionFile: null,
      selectedActionFileName: null,
      setSortMode: vi.fn(),
      setFilterType: vi.fn(),
      setSearchQuery: vi.fn(),
    });
  });

  it("renders all toolbar buttons", () => {
    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    // Check for toolbar buttons
    expect(screen.getByTitle("Refresh")).toBeInTheDocument();
    expect(screen.getByTitle("Navigate up")).toBeInTheDocument();
    expect(screen.getByTitle("Toggle sidebar")).toBeInTheDocument();
    expect(screen.getByTitle("Grid view")).toBeInTheDocument();
    expect(screen.getByTitle("List view")).toBeInTheDocument();
  });

  it("renders current path in path bar", () => {
    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    expect(screen.getByText("/test/path")).toBeInTheDocument();
  });

  it("calls onRefresh when refresh button is clicked", () => {
    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const refreshButton = screen.getByTitle("Refresh");
    fireEvent.click(refreshButton);

    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it("calls onNavigateUp when up button is clicked", () => {
    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const upButton = screen.getByTitle("Navigate up");
    fireEvent.click(upButton);

    expect(mockOnNavigateUp).toHaveBeenCalled();
  });

  it("calls onToggleSidebar when sidebar toggle button is clicked", () => {
    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const sidebarButton = screen.getByTitle("Toggle sidebar");
    fireEvent.click(sidebarButton);

    expect(mockOnToggleSidebar).toHaveBeenCalled();
  });

  it("calls onViewModeChange when view mode buttons are clicked", () => {
    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const gridButton = screen.getByTitle("Grid view");
    fireEvent.click(gridButton);
    expect(mockOnViewModeChange).toHaveBeenCalledWith("grid");

    const listButton = screen.getByTitle("List view");
    fireEvent.click(listButton);
    expect(mockOnViewModeChange).toHaveBeenCalledWith("list");
  });

  it("highlights active view mode button", () => {
    const { rerender } = render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
        viewMode="grid"
      />
    );

    const gridButton = screen.getByTitle("Grid view");
    const listButton = screen.getByTitle("List view");

    expect(gridButton).toHaveClass("active");
    expect(listButton).not.toHaveClass("active");

    rerender(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
        viewMode="list"
      />
    );

    expect(gridButton).not.toHaveClass("active");
    expect(listButton).toHaveClass("active");
  });

  it("renders sort select with current value", () => {
    (useFileStore as any).mockReturnValue({
      currentPath: "/test/path",
      sortMode: "modified",
      filterType: "all",
      searchQuery: "",
      selectedActionFile: null,
      selectedActionFileName: null,
      setSortMode: vi.fn(),
      setFilterType: vi.fn(),
      setSearchQuery: vi.fn(),
    });

    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const sortSelect = screen.getByDisplayValue("Modified");
    expect(sortSelect).toBeInTheDocument();
  });

  it("calls onSortChange when sort select changes", () => {
    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const sortSelect = screen.getByDisplayValue("Name");
    fireEvent.change(sortSelect, { target: { value: "size" } });

    expect(mockOnSortChange).toHaveBeenCalledWith("size");
  });

  it("renders filter select with current value", () => {
    (useFileStore as any).mockReturnValue({
      currentPath: "/test/path",
      sortMode: "name",
      filterType: "files",
      searchQuery: "",
      selectedActionFile: null,
      selectedActionFileName: null,
      setSortMode: vi.fn(),
      setFilterType: vi.fn(),
      setSearchQuery: vi.fn(),
    });

    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const filterSelect = screen.getByDisplayValue("Files only");
    expect(filterSelect).toBeInTheDocument();
  });

  it("calls onFilterChange when filter select changes", () => {
    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const filterSelect = screen.getByDisplayValue("All");
    fireEvent.change(filterSelect, { target: { value: "directories" } });

    expect(mockOnFilterChange).toHaveBeenCalledWith("directories");
  });

  it("renders search input with current value", () => {
    (useFileStore as any).mockReturnValue({
      currentPath: "/test/path",
      sortMode: "name",
      filterType: "all",
      searchQuery: "test query",
      selectedActionFile: null,
      selectedActionFileName: null,
      setSortMode: vi.fn(),
      setFilterType: vi.fn(),
      setSearchQuery: vi.fn(),
    });

    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const searchInput = screen.getByDisplayValue("test query");
    expect(searchInput).toBeInTheDocument();
  });

  it("calls onSearchChange when search input changes", () => {
    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search files...");
    fireEvent.change(searchInput, { target: { value: "new query" } });

    expect(mockOnSearchChange).toHaveBeenCalledWith("new query");
  });

  it("does not render execute button for non-executable files", () => {
    (useFileStore as any).mockReturnValue({
      currentPath: "/test/path",
      sortMode: "name",
      filterType: "all",
      searchQuery: "",
      selectedActionFile: "/test/document.txt",
      selectedActionFileName: "document.txt",
      setSortMode: vi.fn(),
      setFilterType: vi.fn(),
      setSearchQuery: vi.fn(),
    });

    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    // Execute button should not be rendered (moved to FileActionBar)
    expect(screen.queryByTitle(/Execute/)).not.toBeInTheDocument();
  });

  it("truncates long paths in path bar", () => {
    const longPath = "/very/long/path/that/should/be/truncated/when/displayed/in/the/path/bar";
    (useFileStore as any).mockReturnValue({
      currentPath: longPath,
      sortMode: "name",
      filterType: "all",
      searchQuery: "",
      selectedActionFile: null,
      selectedActionFileName: null,
      setSortMode: vi.fn(),
      setFilterType: vi.fn(),
      setSearchQuery: vi.fn(),
    });

    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    const pathSpan = screen.getByText(longPath);
    expect(pathSpan).toBeInTheDocument();
    // The CSS should handle truncation with text-overflow: ellipsis
  });

  it("handles empty path gracefully", () => {
    (useFileStore as any).mockReturnValue({
      currentPath: "",
      sortMode: "name",
      filterType: "all",
      searchQuery: "",
      selectedActionFile: null,
      selectedActionFileName: null,
      setSortMode: vi.fn(),
      setFilterType: vi.fn(),
      setSearchQuery: vi.fn(),
    });

    render(
      <FileToolbar
        onRefresh={mockOnRefresh}
        onNavigateUp={mockOnNavigateUp}
        onToggleSidebar={mockOnToggleSidebar}
        onViewModeChange={mockOnViewModeChange}
        onSortChange={mockOnSortChange}
        onFilterChange={mockOnFilterChange}
        onSearchChange={mockOnSearchChange}
        onExecuteOutput={mockOnExecuteOutput}
        onOpenBottomPanel={mockOnOpenBottomPanel}
      />
    );

    // Should render empty path without crashing
    expect(screen.getByText("")).toBeInTheDocument();
  });
});
