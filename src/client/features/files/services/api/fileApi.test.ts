/**
 * FileApi Utility Functions Tests
 * 测试纯工具函数，不涉及真实文件系统
 */

import { describe, expect, it } from "vitest";
import { formatFileSize, getFileExtension, getFileIcon } from "./fileApi";

describe("FileApi Utils", () => {
  describe("formatFileSize", () => {
    it('should return "-" for undefined/null', () => {
      expect(formatFileSize(undefined as any)).toBe("-");
      expect(formatFileSize(null as any)).toBe("-");
    });

    it("should format 0 bytes", () => {
      expect(formatFileSize(0)).toBe("0 B");
    });

    it("should format bytes correctly", () => {
      expect(formatFileSize(100)).toBe("100 B");
      expect(formatFileSize(512)).toBe("512 B");
    });

    it("should format kilobytes correctly", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
      expect(formatFileSize(10240)).toBe("10 KB");
    });

    it("should format megabytes correctly", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
    });

    it("should format gigabytes correctly", () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
      expect(formatFileSize(1024 * 1024 * 1024 * 1.5)).toBe("1.5 GB");
    });

    it("should format terabytes correctly", () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe("1 TB");
    });
  });

  describe("getFileIcon", () => {
    it("should return folder icon for directories", () => {
      expect(getFileIcon(undefined, true)).toBe("📁");
    });

    it("should return icon for JavaScript files", () => {
      expect(getFileIcon("js", false)).toBe("📜");
    });

    it("should return icon for TypeScript files", () => {
      expect(getFileIcon("ts", false)).toBe("📘");
    });

    it("should return icon for React files", () => {
      expect(getFileIcon("jsx", false)).toBe("⚛️");
      expect(getFileIcon("tsx", false)).toBe("⚛️");
    });

    it("should return icon for Python files", () => {
      expect(getFileIcon("py", false)).toBe("🐍");
    });

    it("should return icon for Markdown files", () => {
      expect(getFileIcon("md", false)).toBe("📝");
    });

    it("should return icon for JSON files", () => {
      expect(getFileIcon("json", false)).toBe("📋");
    });

    it("should return icon for CSS files", () => {
      expect(getFileIcon("css", false)).toBe("🎨");
    });

    it("should return default icon for unknown extensions", () => {
      expect(getFileIcon("xyz", false)).toBe("📄");
    });

    it("should return default icon when extension is undefined", () => {
      expect(getFileIcon(undefined, false)).toBe("📄");
    });
  });

  describe("getFileExtension", () => {
    it("should extract extension from filename", () => {
      expect(getFileExtension("test.js")).toBe("js");
      expect(getFileExtension("file.min.js")).toBe("js");
    });

    it("should return empty string for files without extension", () => {
      expect(getFileExtension("Makefile")).toBe("");
      expect(getFileExtension("README")).toBe("");
    });

    it("should handle hidden files", () => {
      expect(getFileExtension(".gitignore")).toBe("");
      expect(getFileExtension(".env.local")).toBe("local");
    });

    it("should return empty string for empty filename", () => {
      expect(getFileExtension("")).toBe("");
    });
  });
});

console.log("[Test] FileApi utils tests loaded");
