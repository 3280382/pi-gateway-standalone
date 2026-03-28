/**
 * FileApi Integration Tests
 * 测试文件 API 调用 (mock fetch)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowseResponse, FileExecuteResponse, FileItem, FileReadResponse } from "../components/files/types";

// Mock fetch
global.fetch = vi.fn();

// File API functions to test
async function browseDirectory(path: string): Promise<FileItem[]> {
	const encodedPath = encodeURIComponent(path);
	const response = await fetch(`/api/browse?path=${encodedPath}`);

	if (!response.ok) {
		throw new Error(`Failed to browse: ${response.statusText}`);
	}

	const data: BrowseResponse = await response.json();
	return data.files.map((file: any) => ({
		name: file.name,
		path: file.path,
		isDirectory: file.type === "directory",
		size: file.size,
		modified: file.modified,
	}));
}

async function readFile(path: string): Promise<{ content: string; language?: string }> {
	const encodedPath = encodeURIComponent(path);
	const response = await fetch(`/api/file/read?path=${encodedPath}`);

	if (!response.ok) {
		throw new Error(`Failed to read file: ${response.statusText}`);
	}

	const data: FileReadResponse = await response.json();
	return { content: data.content };
}

async function writeFile(path: string, content: string): Promise<void> {
	const response = await fetch("/api/file/write", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path, content }),
	});

	if (!response.ok) {
		throw new Error(`Failed to write file: ${response.statusText}`);
	}
}

async function executeFile(path: string): Promise<FileExecuteResponse> {
	const encodedPath = encodeURIComponent(path);
	const response = await fetch(`/api/file/execute?path=${encodedPath}`);

	if (!response.ok) {
		throw new Error(`Failed to execute file: ${response.statusText}`);
	}

	return await response.json();
}

describe("FileApi Integration", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe("browseDirectory", () => {
		it("should return file list on success", async () => {
			const mockFiles = [
				{ name: "file1.txt", path: "/test/file1.txt", type: "file", size: 100, modified: "2024-01-01" },
				{ name: "folder1", path: "/test/folder1", type: "directory", modified: "2024-01-02" },
			];

			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ files: mockFiles }),
			});

			const result = await browseDirectory("/test");

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("file1.txt");
			expect(result[0].isDirectory).toBe(false);
			expect(result[1].isDirectory).toBe(true);
		});

		it("should throw error on failure", async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: false,
				statusText: "Not Found",
			});

			await expect(browseDirectory("/invalid")).rejects.toThrow("Failed to browse: Not Found");
		});

		it("should encode path parameter", async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ files: [] }),
			});

			await browseDirectory("/path with spaces");

			expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("/path with spaces")));
		});
	});

	describe("readFile", () => {
		it("should return file content", async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ content: "Hello World" }),
			});

			const result = await readFile("/test/file.txt");

			expect(result.content).toBe("Hello World");
		});

		it("should throw error when file not found", async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: false,
				statusText: "File not found",
			});

			await expect(readFile("/missing.txt")).rejects.toThrow("Failed to read file: File not found");
		});
	});

	describe("writeFile", () => {
		it("should write file content", async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true }),
			});

			await writeFile("/test/file.txt", "New content");

			expect(global.fetch).toHaveBeenCalledWith("/api/file/write", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: "/test/file.txt", content: "New content" }),
			});
		});

		it("should throw error on write failure", async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: false,
				statusText: "Permission denied",
			});

			await expect(writeFile("/readonly.txt", "content")).rejects.toThrow("Permission denied");
		});
	});

	describe("executeFile", () => {
		it("should execute script and return output", async () => {
			const mockResponse = {
				stdout: "Hello",
				stderr: "",
				exitCode: 0,
			};

			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await executeFile("/test/script.sh");

			expect(result.stdout).toBe("Hello");
			expect(result.exitCode).toBe(0);
		});

		it("should handle execution errors", async () => {
			const mockResponse = {
				stdout: "",
				stderr: "Command not found",
				exitCode: 127,
			};

			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await executeFile("/test/invalid.sh");

			expect(result.stderr).toBe("Command not found");
			expect(result.exitCode).toBe(127);
		});
	});
});

console.log("[Test] FileApi integration tests loaded");
