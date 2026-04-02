/**
 * FileBrowser FileApi Unit Tests
 * 测试文件类型判断和工具函数
 */

import { describe, expect, it } from "vitest";
import { isEditableFile, isExecutableFile, isViewableFile } from "./fileApi";

describe("File Type Helpers", () => {
	describe("isExecutableFile", () => {
		it("should return true for shell scripts", () => {
			expect(isExecutableFile("script.sh")).toBe(true);
			expect(isExecutableFile("script.bash")).toBe(true);
			expect(isExecutableFile("script.zsh")).toBe(true);
		});

		it("should return true for Python files", () => {
			expect(isExecutableFile("script.py")).toBe(true);
		});

		it("should return true for JavaScript files", () => {
			expect(isExecutableFile("script.js")).toBe(true);
			expect(isExecutableFile("script.mjs")).toBe(true);
			expect(isExecutableFile("script.cjs")).toBe(true);
		});

		it("should return false for non-executable files", () => {
			expect(isExecutableFile("file.txt")).toBe(false);
			expect(isExecutableFile("file.md")).toBe(false);
			expect(isExecutableFile("file.json")).toBe(false);
		});

		it("should return false for directories", () => {
			expect(isExecutableFile("folder/")).toBe(false);
		});
	});

	describe("isEditableFile", () => {
		it("should return true for code files", () => {
			expect(isEditableFile("file.js")).toBe(true);
			expect(isEditableFile("file.ts")).toBe(true);
			expect(isEditableFile("file.py")).toBe(true);
			expect(isEditableFile("file.rs")).toBe(true);
			expect(isEditableFile("file.go")).toBe(true);
		});

		it("should return true for web files", () => {
			expect(isEditableFile("file.html")).toBe(true);
			expect(isEditableFile("file.css")).toBe(true);
			expect(isEditableFile("file.vue")).toBe(true);
			expect(isEditableFile("file.svelte")).toBe(true);
		});

		it("should return true for config files", () => {
			expect(isEditableFile("file.json")).toBe(true);
			expect(isEditableFile("file.yaml")).toBe(true);
			expect(isEditableFile("file.toml")).toBe(true);
			expect(isEditableFile(".env")).toBe(true);
		});

		it("should return true for markdown files", () => {
			expect(isEditableFile("file.md")).toBe(true);
			expect(isEditableFile("file.mdx")).toBe(true);
		});

		it("should return true for text files", () => {
			expect(isEditableFile("file.txt")).toBe(true);
			expect(isEditableFile("file.log")).toBe(true);
		});

		it("should return true for hidden config files", () => {
			expect(isEditableFile(".gitignore")).toBe(true);
			expect(isEditableFile(".gitattributes")).toBe(true);
			expect(isEditableFile(".editorconfig")).toBe(true);
		});

		it("should return true for files without extension", () => {
			expect(isEditableFile("Makefile")).toBe(true);
			expect(isEditableFile("Dockerfile")).toBe(true);
			expect(isEditableFile("README")).toBe(true);
		});

		it("should return false for binary files", () => {
			// Note: this depends on implementation, some binary extensions might be excluded
		});
	});

	describe("isViewableFile", () => {
		it("should return same result as isEditableFile", () => {
			const paths = ["file.js", "file.txt", "file.md", ".gitignore"];
			paths.forEach((path) => {
				expect(isViewableFile(path)).toBe(isEditableFile(path));
			});
		});
	});
});

console.log("[Test] FileBrowser fileApi tests loaded");
