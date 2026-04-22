import { describe, expect, it } from "vitest";
import {
  expandPath,
  formatFileSize,
  formatTimeAgo,
  getExtension,
  getMimeType,
  isBinaryFile,
  isHighlightable,
  isPathAllowed,
} from "./utils.js";

describe("files/utils", () => {
  describe("expandPath", () => {
    it("expands ~ to home directory", () => {
      const home = process.env.HOME || "/root";
      expect(expandPath("~")).toBe(home);
      expect(expandPath("~/docs")).toBe(`${home}/docs`);
    });

    it("returns absolute paths unchanged", () => {
      expect(expandPath("/usr/local")).toBe("/usr/local");
    });
  });

  describe("isPathAllowed", () => {
    it("allows paths within home directory", () => {
      expect(isPathAllowed("~/documents")).toBe(true);
    });

    it("allows paths within cwd", () => {
      expect(isPathAllowed("./src")).toBe(true);
    });

    it("allows /tmp paths", () => {
      expect(isPathAllowed("/tmp/test")).toBe(true);
    });

    it("blocks paths outside allowed prefixes", () => {
      expect(isPathAllowed("/etc/passwd")).toBe(false);
      expect(isPathAllowed("/unknown/path")).toBe(false);
    });
  });

  describe("getExtension", () => {
    it.each([
      ["file.txt", ".txt"],
      ["image.PNG", ".png"],
      ["archive.tar.gz", ".gz"],
      ["no-extension", ""],
      [".gitignore", ""],
    ])("gets extension of %s → %s", (input, expected) => {
      expect(getExtension(input)).toBe(expected);
    });
  });

  describe("getMimeType", () => {
    it.each([
      ["index.html", "text/html"],
      ["script.js", "application/javascript"],
      ["style.css", "text/css"],
      ["data.json", "application/json"],
      ["image.png", "image/png"],
      ["photo.jpg", "image/jpeg"],
      ["unknown.xyz", "application/octet-stream"],
    ])("maps %s → %s", (input, expected) => {
      expect(getMimeType(input)).toBe(expected);
    });
  });

  describe("isHighlightable", () => {
    it.each([
      ["code.js", true],
      ["App.tsx", true],
      ["script.py", true],
      ["data.json", true],
      ["image.jpg", false],
      ["archive.zip", false],
      ["binary.exe", false],
    ])("%s highlightable=%s", (input, expected) => {
      expect(isHighlightable(input)).toBe(expected);
    });
  });

  describe("isBinaryFile", () => {
    it.each([
      ["image.png", true],
      ["photo.jpg", true],
      ["video.mp4", true],
      ["archive.zip", true],
      ["doc.pdf", true],
      ["script.js", false],
      ["README.md", false],
      ["config.json", false],
    ])("%s binary=%s", (input, expected) => {
      expect(isBinaryFile(input)).toBe(expected);
    });
  });

  describe("formatFileSize", () => {
    it.each([
      [0, "0 B"],
      [512, "512.00 B"],
      [1024, "1.00 KB"],
      [1536, "1.50 KB"],
      [1048576, "1.00 MB"],
      [1073741824, "1.00 GB"],
    ])("formats %d → %s", (bytes, expected) => {
      expect(formatFileSize(bytes)).toBe(expected);
    });
  });

  describe("formatTimeAgo", () => {
    it("formats seconds ago", () => {
      const now = new Date();
      const fiveSecondsAgo = new Date(now.getTime() - 5000);
      expect(formatTimeAgo(fiveSecondsAgo)).toBe("5seconds ago");
    });

    it("formats minutes ago", () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(formatTimeAgo(fiveMinutesAgo)).toBe("5minutes ago");
    });

    it("formats hours ago", () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(formatTimeAgo(twoHoursAgo)).toBe("2hours ago");
    });

    it("formats days ago", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(formatTimeAgo(threeDaysAgo)).toBe("3days ago");
    });
  });
});
