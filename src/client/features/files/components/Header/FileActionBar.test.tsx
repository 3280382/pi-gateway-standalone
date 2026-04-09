/**
 * FileActionBar Component Tests
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/viewerStore";
import { FileActionBar } from "./FileActionBar";

// Mock stores
vi.mock("@/stores/fileStore", () => ({
	useFileStore: vi.fn(),
}));

vi.mock("@/stores/viewerStore", () => ({
	useFileViewerStore: vi.fn(),
}));

// Mock API
vi.mock("@/services/api/fileApi", () => ({
	executeFile: vi.fn(),
}));

describe("FileActionBar", () => {
	const mockOpenViewer = vi.fn();
	const mockOnExecute = vi.fn();
	const mockOnOpenBottomPanel = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock implementations
		(useFileStore as any).mockReturnValue({
			selectedActionFile: "/test/file.js",
			selectedActionFileName: "file.js",
		});

		(useFileViewerStore as any).mockReturnValue({
			openViewer: mockOpenViewer,
		});
	});

	it("renders nothing when no file is selected", () => {
		(useFileStore as any).mockReturnValue({
			selectedActionFile: null,
			selectedActionFileName: null,
		});

		const { container } = render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		expect(container.firstChild).toBeNull();
	});

	it("renders selected file name", () => {
		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		expect(screen.getByText("file.js")).toBeInTheDocument();
	});

	it("renders View button for all files", () => {
		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		const viewButton = screen.getByText("View");
		expect(viewButton).toBeInTheDocument();
		expect(viewButton.closest("button")).toHaveClass("view");
	});

	it("renders Edit button for editable files", () => {
		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		const editButton = screen.getByText("Edit");
		expect(editButton).toBeInTheDocument();
		expect(editButton.closest("button")).toHaveClass("edit");
	});

	it("does not render Edit button for image files", () => {
		(useFileStore as any).mockReturnValue({
			selectedActionFile: "/test/image.png",
			selectedActionFileName: "image.png",
		});

		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		expect(screen.queryByText("Edit")).not.toBeInTheDocument();
	});

	it("renders Run button for executable files", () => {
		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		const runButton = screen.getByText("Run");
		expect(runButton).toBeInTheDocument();
		expect(runButton.closest("button")).toHaveClass("execute");
	});

	it("does not render Run button for non-executable files", () => {
		(useFileStore as any).mockReturnValue({
			selectedActionFile: "/test/document.txt",
			selectedActionFileName: "document.txt",
		});

		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		expect(screen.queryByText("Run")).not.toBeInTheDocument();
	});

	it("renders Run button for files with executable extensions", () => {
		const testCases = [
			{ file: "script.sh", shouldShow: true },
			{ file: "script.py", shouldShow: true },
			{ file: "script.js", shouldShow: true },
			{ file: "script.ts", shouldShow: true },
			{ file: "script.pl", shouldShow: true },
			{ file: "script.rb", shouldShow: true },
			{ file: "script.php", shouldShow: true },
			{ file: "script.go", shouldShow: true },
			{ file: "script.java", shouldShow: true },
			{ file: "script.c", shouldShow: true },
			{ file: "script.cpp", shouldShow: true },
			{ file: "script.rs", shouldShow: true },
			{ file: "document.txt", shouldShow: false },
			{ file: "image.png", shouldShow: false },
			{ file: "data.json", shouldShow: false },
		];

		testCases.forEach(({ file, shouldShow }) => {
			(useFileStore as any).mockReturnValue({
				selectedActionFile: `/test/${file}`,
				selectedActionFileName: file,
			});

			const { unmount } = render(
				<FileActionBar
					onExecute={mockOnExecute}
					onOpenBottomPanel={mockOnOpenBottomPanel}
				/>,
			);

			if (shouldShow) {
				expect(screen.getByText("Run")).toBeInTheDocument();
			} else {
				expect(screen.queryByText("Run")).not.toBeInTheDocument();
			}

			unmount();
		});
	});

	it("calls openViewer with view mode when View button is clicked", () => {
		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		const viewButton = screen.getByText("View");
		fireEvent.click(viewButton);

		expect(mockOpenViewer).toHaveBeenCalledWith(
			"/test/file.js",
			"file.js",
			"view",
		);
	});

	it("calls openViewer with edit mode when Edit button is clicked", () => {
		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		const editButton = screen.getByText("Edit");
		fireEvent.click(editButton);

		expect(mockOpenViewer).toHaveBeenCalledWith(
			"/test/file.js",
			"file.js",
			"edit",
		);
	});

	it("executes file and calls callbacks when Run button is clicked", async () => {
		const { executeFile } = await import("@/services/api/fileApi");
		(executeFile as any).mockResolvedValue("Execution completed");

		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		const runButton = screen.getByText("Run");
		fireEvent.click(runButton);

		await waitFor(() => {
			expect(executeFile).toHaveBeenCalledWith(
				"/test/file.js",
				expect.any(Function),
			);
			expect(mockOnOpenBottomPanel).toHaveBeenCalledWith(
				"\n[Execution completed]\n",
			);
		});
	});

	it("handles execution errors and calls callbacks", async () => {
		const { executeFile } = await import("@/services/api/fileApi");
		const error = new Error("Execution failed");
		(executeFile as any).mockRejectedValue(error);

		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		const runButton = screen.getByText("Run");
		fireEvent.click(runButton);

		await waitFor(() => {
			expect(executeFile).toHaveBeenCalledWith(
				"/test/file.js",
				expect.any(Function),
			);
			expect(mockOnExecute).toHaveBeenCalledWith("Error: Execution failed");
			expect(mockOnOpenBottomPanel).toHaveBeenCalledWith(
				"\nError: Execution failed\n",
			);
		});
	});

	it("handles files without extensions", () => {
		(useFileStore as any).mockReturnValue({
			selectedActionFile: "/test/script",
			selectedActionFileName: "script",
		});

		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		// Files without extensions should be considered executable
		expect(screen.getByText("Run")).toBeInTheDocument();
	});

	it("handles files with multiple dots in name", () => {
		(useFileStore as any).mockReturnValue({
			selectedActionFile: "/test/script.test.js",
			selectedActionFileName: "script.test.js",
		});

		render(
			<FileActionBar
				onExecute={mockOnExecute}
				onOpenBottomPanel={mockOnOpenBottomPanel}
			/>,
		);

		// Should correctly identify .js extension
		expect(screen.getByText("Run")).toBeInTheDocument();
	});
});
