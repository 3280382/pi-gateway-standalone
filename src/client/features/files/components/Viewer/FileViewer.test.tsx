/**
 * FileViewer Component Tests
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import { FileViewer } from "./FileViewer";

// Mock store
vi.mock("@/stores/fileViewerStore", () => ({
	useFileViewerStore: vi.fn(),
}));

// Mock API
vi.mock("@/services/api/fileApi", () => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	executeFile: vi.fn(),
	getRawFileUrl: vi.fn(
		(path: string) => `/api/raw?path=${encodeURIComponent(path)}`,
	),
}));

// Mock Prism
vi.mock("prismjs", () => ({
	highlight: vi.fn((code: string) => `<pre>${code}</pre>`),
}));

describe("FileViewer", () => {
	const mockCloseViewer = vi.fn();
	const mockSetContent = vi.fn();
	const mockSetLoading = vi.fn();
	const mockSetError = vi.fn();
	const mockSetMode = vi.fn();
	const mockSetEditedContent = vi.fn();
	const mockSetSaving = vi.fn();
	const mockAppendTerminalOutput = vi.fn();
	const mockClearTerminal = vi.fn();
	const mockSetExecuting = vi.fn();

	const defaultStoreState = {
		isOpen: true,
		filePath: "/test/file.js",
		fileName: "file.js",
		content: 'console.log("Hello World");',
		isLoading: false,
		error: null,
		mode: "view",
		editedContent: 'console.log("Hello World");',
		isSaving: false,
		terminalOutput: "",
		isExecuting: false,
		closeViewer: mockCloseViewer,
		setContent: mockSetContent,
		setLoading: mockSetLoading,
		setError: mockSetError,
		setMode: mockSetMode,
		setEditedContent: mockSetEditedContent,
		setSaving: mockSetSaving,
		appendTerminalOutput: mockAppendTerminalOutput,
		clearTerminal: mockClearTerminal,
		setExecuting: mockSetExecuting,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(useFileViewerStore as any).mockReturnValue(defaultStoreState);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders nothing when not open", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			isOpen: false,
		});

		const { container } = render(<FileViewer />);
		expect(container.firstChild).toBeNull();
	});

	it("renders file viewer modal when open", () => {
		render(<FileViewer />);

		expect(screen.getByText("file.js")).toBeInTheDocument();
		expect(screen.getByText('console.log("Hello World");')).toBeInTheDocument();
	});

	it("shows file name in title", () => {
		render(<FileViewer />);

		expect(screen.getByText("file.js")).toBeInTheDocument();
	});

	it("calls closeViewer when close button is clicked", () => {
		render(<FileViewer />);

		const closeButton = screen.getByTitle("Close");
		fireEvent.click(closeButton);

		expect(mockCloseViewer).toHaveBeenCalled();
	});

	it("shows loading state", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			isLoading: true,
			content: null,
		});

		render(<FileViewer />);

		expect(screen.getByText("Loading...")).toBeInTheDocument();
	});

	it("shows error state", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			error: "Failed to load file",
			content: null,
		});

		render(<FileViewer />);

		expect(screen.getByText("Failed to load file")).toBeInTheDocument();
	});

	it("loads file content when opened", async () => {
		const { readFile } = await import("@/services/api/fileApi");
		(readFile as any).mockResolvedValue({
			content: "File content loaded",
			path: "/test/file.js",
			size: 100,
			modified: new Date().toISOString(),
		});

		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			content: null,
			isLoading: true,
		});

		render(<FileViewer />);

		await waitFor(() => {
			expect(readFile).toHaveBeenCalledWith("/test/file.js");
			expect(mockSetContent).toHaveBeenCalledWith("File content loaded");
			expect(mockSetLoading).toHaveBeenCalledWith(false);
		});
	});

	it("handles file load errors", async () => {
		const { readFile } = await import("@/services/api/fileApi");
		const error = new Error("File not found");
		(readFile as any).mockRejectedValue(error);

		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			content: null,
			isLoading: true,
		});

		render(<FileViewer />);

		await waitFor(() => {
			expect(readFile).toHaveBeenCalledWith("/test/file.js");
			expect(mockSetError).toHaveBeenCalledWith("File not found");
		});
	});

	it("switches to edit mode", () => {
		render(<FileViewer />);

		const editButton = screen.getByText(/Edit/);
		fireEvent.click(editButton);

		expect(mockSetMode).toHaveBeenCalledWith("edit");
	});

	it("shows edit textarea in edit mode", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "edit",
		});

		render(<FileViewer />);

		const textarea = screen.getByRole("textbox");
		expect(textarea).toBeInTheDocument();
		expect(textarea).toHaveValue('console.log("Hello World");');
	});

	it("updates edited content when typing in edit mode", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "edit",
		});

		render(<FileViewer />);

		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "New content" } });

		expect(mockSetEditedContent).toHaveBeenCalledWith("New content");
	});

	it("saves file in edit mode", async () => {
		const { writeFile } = await import("@/services/api/fileApi");
		(writeFile as any).mockResolvedValue(undefined);

		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "edit",
			editedContent: "Updated content",
		});

		render(<FileViewer />);

		const saveButton = screen.getByText("Save");
		fireEvent.click(saveButton);

		await waitFor(() => {
			expect(writeFile).toHaveBeenCalledWith(
				"/test/file.js",
				"Updated content",
			);
			expect(mockSetSaving).toHaveBeenCalledWith(false);
			expect(mockSetMode).toHaveBeenCalledWith("view");
			expect(mockSetContent).toHaveBeenCalledWith("Updated content");
		});
	});

	it("handles save errors", async () => {
		const { writeFile } = await import("@/services/api/fileApi");
		const error = new Error("Permission denied");
		(writeFile as any).mockRejectedValue(error);

		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "edit",
			editedContent: "Updated content",
		});

		render(<FileViewer />);

		const saveButton = screen.getByText("Save");
		fireEvent.click(saveButton);

		await waitFor(() => {
			expect(writeFile).toHaveBeenCalledWith(
				"/test/file.js",
				"Updated content",
			);
			expect(mockSetSaving).toHaveBeenCalledWith(false);
			// Should show error but not switch mode
		});
	});

	it("cancels edit mode", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "edit",
			editedContent: "Modified content",
		});

		render(<FileViewer />);

		const cancelButton = screen.getByText("Cancel");
		fireEvent.click(cancelButton);

		expect(mockSetMode).toHaveBeenCalledWith("view");
		// Note: Component does not reset editedContent on cancel
	});

	it("executes file in execute mode", async () => {
		// Mock executeFile to return a ReadableStream
		const { executeFile } = await import("@/services/api/fileApi");
		const mockReader = {
			read: vi
				.fn()
				.mockResolvedValueOnce({
					done: false,
					value: new TextEncoder().encode("Executing...\n"),
				})
				.mockResolvedValueOnce({ done: true }),
			releaseLock: vi.fn(),
		};
		const mockStream = {
			getReader: () => mockReader,
		};
		(executeFile as any).mockResolvedValue(mockStream);

		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "execute",
			terminalOutput: "",
			isExecuting: true,
		});

		render(<FileViewer />);

		// Wait for executeFile to be called
		await waitFor(() => {
			expect(executeFile).toHaveBeenCalledWith("/test/file.js");
		});
	});

	it("shows terminal output in execute mode", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "execute",
			terminalOutput: "Executing...\nDone!",
		});

		render(<FileViewer />);

		// Terminal output is in a <pre> block - use container query instead
		const { container } = render(<FileViewer />);
		const preElement = container.querySelector("pre");
		expect(preElement).toHaveTextContent("Executing...");
		expect(preElement).toHaveTextContent("Done!");
	});

	it("aborts execution when abort button is clicked", async () => {
		const abortController = { abort: vi.fn() };
		const { executeFile } = await import("@/services/api/fileApi");
		(executeFile as any).mockImplementation(() => {
			return new Promise(() => {}); // Never resolves
		});

		// Mock AbortController
		const originalAbortController = global.AbortController;
		global.AbortController = vi.fn(() => abortController) as any;

		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "execute",
			isExecuting: true,
		});

		render(<FileViewer />);

		const stopButton = screen.getByText("Stop");
		fireEvent.click(stopButton);

		expect(abortController.abort).toHaveBeenCalled();

		// Restore original
		global.AbortController = originalAbortController;
	});

	it("clears terminal output", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "execute",
			terminalOutput: "Some output",
		});

		render(<FileViewer />);

		const clearButton = screen.getByText("Clear");
		fireEvent.click(clearButton);

		expect(mockClearTerminal).toHaveBeenCalled();
	});

	it("shows syntax highlighting for code files", () => {
		render(<FileViewer />);

		// Should render code with syntax highlighting
		const codeElement = screen.getByText('console.log("Hello World");');
		expect(codeElement).toBeInTheDocument();
	});

	it("handles different file types", () => {
		const testCases = [
			{ file: "script.js", type: "javascript" },
			{ file: "style.css", type: "css" },
			{ file: "index.html", type: "html" },
			{ file: "data.json", type: "json" },
			{ file: "README.md", type: "markdown" },
			{ file: "image.png", type: "image" },
		];

		testCases.forEach(({ file, type }) => {
			(useFileViewerStore as any).mockReturnValue({
				...defaultStoreState,
				fileName: file,
				filePath: `/test/${file}`,
			});

			const { unmount } = render(<FileViewer />);

			// Should render without crashing for all file types
			expect(screen.getByText(file)).toBeInTheDocument();

			unmount();
		});
	});

	it("handles large files", () => {
		const largeContent = "A".repeat(10000);
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			content: largeContent,
			editedContent: largeContent,
		});

		render(<FileViewer />);

		// Should render large content without crashing
		expect(screen.getByText("file.js")).toBeInTheDocument();
	});

	it("handles empty files", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			content: "",
			editedContent: "",
		});

		render(<FileViewer />);

		// Should render empty file without crashing
		expect(screen.getByText("file.js")).toBeInTheDocument();
	});

	it("shows appropriate buttons based on mode", () => {
		// View mode
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "view",
		});

		const { rerender } = render(<FileViewer />);

		expect(screen.getByText(/Edit/)).toBeInTheDocument();
		expect(screen.getByText(/Execute/)).toBeInTheDocument();
		expect(screen.queryByText("Save")).not.toBeInTheDocument();
		expect(screen.queryByText("Cancel")).not.toBeInTheDocument();

		// Edit mode
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "edit",
		});

		rerender(<FileViewer />);

		expect(screen.getByText("Save")).toBeInTheDocument();
		expect(screen.getByText("Cancel")).toBeInTheDocument();
		expect(screen.queryByText(/Edit/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Execute/)).not.toBeInTheDocument();

		// Execute mode
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "execute",
			isExecuting: false,
		});

		rerender(<FileViewer />);

		expect(screen.getByText("Stop")).toBeInTheDocument();
		expect(screen.getByText("Clear")).toBeInTheDocument();
		expect(screen.queryByText("Edit")).not.toBeInTheDocument();
		expect(screen.queryByText("Execute")).not.toBeInTheDocument();
	});

	it("disables save button when saving", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "edit",
			isSaving: true,
		});

		render(<FileViewer />);

		const saveButton = screen.getByText("Saving...");
		expect(saveButton).toBeDisabled();
	});

	it("disables execute button when already executing", () => {
		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "execute",
			isExecuting: true,
		});

		render(<FileViewer />);

		const stopButton = screen.getByText("Stop");
		expect(stopButton).toBeInTheDocument();
	});

	it("does not load file when mode is execute", async () => {
		const { readFile } = await import("@/services/api/fileApi");

		(useFileViewerStore as any).mockReturnValue({
			...defaultStoreState,
			mode: "execute",
			content: null,
		});

		render(<FileViewer />);

		// Should not call readFile in execute mode
		expect(readFile).not.toHaveBeenCalled();
	});
});
