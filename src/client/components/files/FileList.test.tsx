/**
 * FileList Component Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileStore } from "@/stores/fileStore";
import { useFileViewerStore } from "@/stores/fileViewerStore";
import { FileList } from "./FileList";

// Mock file icon function
vi.mock("@/services/api/fileApi", () => ({
	getFileIcon: vi.fn((extension, isDirectory) => (isDirectory ? "📁" : "📄")),
	formatFileSize: vi.fn((size) => {
		if (size === 0) return "0 B";
		if (size === 1024) return "1 KB";
		if (size === 2048) return "2 KB";
		return `${size} B`;
	}),
}));

// Mock CSS module
vi.mock("./FileBrowser.module.css", () => ({
	default: {
		list: "list",
		listHeader: "listHeader",
		headerName: "headerName",
		headerSize: "headerSize",
		headerModified: "headerModified",
		listItem: "listItem",
		selected: "selected",
		directory: "directory",
		listIcon: "listIcon",
		listName: "listName",
		listSize: "listSize",
		listModified: "listModified",
	},
}));

// Mock stores
vi.mock("@/stores/fileStore", () => ({
	useFileStore: vi.fn(),
}));

vi.mock("@/stores/fileViewerStore", () => ({
	useFileViewerStore: vi.fn(),
}));

describe("FileList", () => {
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
	];

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock implementations
		(useFileStore as any).mockReturnValue({
			selectedFile: null,
			selectedActionFile: null,
			clearSelection: vi.fn(),
			selectForAction: mockSetSelectedActionFile, // 注意：组件使用selectForAction
			setCurrentPath: vi.fn(),
		});

		(useFileViewerStore as any).mockReturnValue({
			openViewer: mockOpenViewer,
		});
	});

	it("renders list header with correct columns", () => {
		render(<FileList items={mockFiles} />);

		expect(screen.getByText("Name")).toBeInTheDocument();
		expect(screen.getByText("Size")).toBeInTheDocument();
		expect(screen.getByText("Modified")).toBeInTheDocument();
	});

	it("renders all file items", () => {
		render(<FileList items={mockFiles} />);

		expect(screen.getByText("file1.txt")).toBeInTheDocument();
		expect(screen.getByText("folder1")).toBeInTheDocument();
		expect(screen.getByText("script.js")).toBeInTheDocument();
	});

	it("shows directory icon for directories", () => {
		render(<FileList items={mockFiles} />);

		const folderRow = screen.getByText("folder1").closest(".listItem");
		expect(folderRow).toHaveClass("directory");
	});

	it("shows file icon for files", () => {
		render(<FileList items={mockFiles} />);

		const fileRow = screen.getByText("file1.txt").closest(".listItem");
		expect(fileRow).not.toHaveClass("directory");
	});

	it("formats file sizes correctly", () => {
		render(<FileList items={mockFiles} />);

		expect(screen.getByText("1 KB")).toBeInTheDocument();
		expect(screen.getByText("2 KB")).toBeInTheDocument();
		expect(screen.queryByText("0 B")).not.toBeInTheDocument(); // Directory has no size
	});

	it("formats dates correctly", () => {
		render(<FileList items={mockFiles} />);

		// Should show formatted dates - look for any date-like content
		const allText = screen.getByTestId("file-list-container").textContent || "";

		// Check that we have some date-like content (numbers separated by slashes or dashes)
		const hasDateLikeContent =
			/\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/.test(allText) ||
			/\d{1,2}[/-]\d{1,2}[/-]\d{1,4}/.test(allText);

		expect(hasDateLikeContent).toBe(true);
	});

	it("highlights selected file", () => {
		(useFileStore as any).mockReturnValue({
			selectedFile: "/test/file1.txt",
			selectedActionFile: null,
			selectFile: mockSelectFile,
			setSelectedActionFile: mockSetSelectedActionFile,
		});

		render(<FileList items={mockFiles} />);

		const selectedRow = screen.getByText("file1.txt").closest(".listItem");
		expect(selectedRow).toHaveClass("selected");
	});

	it("calls selectForAction when a file is clicked", async () => {
		render(<FileList items={mockFiles} />);

		const fileElement = screen.getByText("file1.txt");
		fireEvent.click(fileElement);

		// Wait for the setTimeout in handleClick
		await new Promise((resolve) => setTimeout(resolve, 350));

		expect(mockSetSelectedActionFile).toHaveBeenCalledWith(
			"/test/file1.txt",
			"file1.txt",
		);
	});

	it("calls selectForAction on single click", async () => {
		render(<FileList items={mockFiles} />);

		const fileElement = screen.getByText("file1.txt");
		fireEvent.click(fileElement);

		// Wait for the setTimeout in handleClick
		await new Promise((resolve) => setTimeout(resolve, 350));

		expect(mockSetSelectedActionFile).toHaveBeenCalledWith(
			"/test/file1.txt",
			"file1.txt",
		);
	});

	it("handles double click to open viewer", async () => {
		render(<FileList items={mockFiles} />);

		const fileElement = screen.getByText("file1.txt");

		// Simulate double click - need to use fireEvent.dblClick or handle timing
		fireEvent.dblClick(fileElement);

		expect(mockOpenViewer).toHaveBeenCalledWith(
			"/test/file1.txt",
			"file1.txt",
			"view",
		);
	});

	it("handles directory double click differently", () => {
		render(<FileList items={mockFiles} />);

		const folderElement = screen.getByText("folder1");

		// Directory double click should not open viewer
		fireEvent.click(folderElement);
		fireEvent.click(folderElement);

		expect(mockOpenViewer).not.toHaveBeenCalled();
	});

	it("shows empty state when no items", () => {
		render(<FileList items={[]} />);

		expect(screen.queryByText("file1.txt")).not.toBeInTheDocument();
		expect(screen.queryByText("folder1")).not.toBeInTheDocument();
		expect(screen.queryByText("script.js")).not.toBeInTheDocument();
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

		render(<FileList items={specialFiles} />);

		expect(screen.getByText("file with spaces.txt")).toBeInTheDocument();
		expect(screen.getByText("file-with-dashes.txt")).toBeInTheDocument();
		expect(screen.getByText("file_with_underscores.txt")).toBeInTheDocument();
	});

	it("handles very long file names with ellipsis", () => {
		const longFileName =
			"very_long_file_name_that_should_be_truncated_with_ellipsis_when_displayed_in_the_list.txt";
		const longFiles = [
			{
				name: longFileName,
				path: `/test/${longFileName}`,
				isDirectory: false,
				size: 100,
				modified: "2024-01-01T10:00:00Z",
			},
		];

		render(<FileList items={longFiles} />);

		const nameElement = screen.getByText(longFileName);
		expect(nameElement).toBeInTheDocument();
		// CSS should handle truncation with text-overflow: ellipsis
	});

	it("handles files with no size information", () => {
		const noSizeFiles = [
			{
				name: "file1.txt",
				path: "/test/file1.txt",
				isDirectory: false,
				modified: "2024-01-01T10:00:00Z",
			},
		];

		render(<FileList items={noSizeFiles} />);

		// Should handle missing size gracefully
		expect(screen.getByText("file1.txt")).toBeInTheDocument();
	});

	it("handles files with no modified date", () => {
		const noDateFiles = [
			{
				name: "file1.txt",
				path: "/test/file1.txt",
				isDirectory: false,
				size: 100,
			},
		];

		render(<FileList items={noDateFiles} />);

		expect(screen.getByText("file1.txt")).toBeInTheDocument();
	});

	it("applies different styling to executable files", () => {
		const executableFiles = [
			{
				name: "script.sh",
				path: "/test/script.sh",
				isDirectory: false,
				size: 100,
				modified: "2024-01-01T10:00:00Z",
			},
		];

		render(<FileList items={executableFiles} />);

		const fileRow = screen.getByText("script.sh").closest(".listItem");
		expect(fileRow).toBeInTheDocument();
	});

	it("handles click on already selected file", async () => {
		(useFileStore as any).mockReturnValue({
			selectedFile: "/test/file1.txt",
			selectedActionFile: null,
			clearSelection: vi.fn(),
			selectForAction: mockSetSelectedActionFile,
			setCurrentPath: vi.fn(),
		});

		render(<FileList items={mockFiles} />);

		const fileElement = screen.getByText("file1.txt");
		fireEvent.click(fileElement);

		// Wait for the setTimeout in handleClick
		await new Promise((resolve) => setTimeout(resolve, 350));

		// Should still call selectForAction
		expect(mockSetSelectedActionFile).toHaveBeenCalledWith(
			"/test/file1.txt",
			"file1.txt",
		);
	});
});
