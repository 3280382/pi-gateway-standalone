import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDuration,
  formatFileSize,
  formatMarkdown,
  formatNumber,
  formatPath,
  formatTimeAgo,
  getFileExtension,
  getFileNameWithoutExt,
  truncateText,
} from "./formatters";

describe("formatters", () => {
  describe("formatFileSize", () => {
    it.each([
      [undefined, ""],
      [null, ""],
      [0, "0 B"],
      [512, "512 B"],
      [1024, "1.0 KB"],
      [1536, "1.5 KB"],
      [1048576, "1.0 MB"],
      [1073741824, "1.0 GB"],
    ])("formats %s bytes → %s", (bytes, expected) => {
      expect(formatFileSize(bytes as number)).toBe(expected);
    });
  });

  describe("formatDate", () => {
    it("formats ISO date string", () => {
      const result = formatDate("2024-01-15T10:30:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns empty string for empty input", () => {
      expect(formatDate("")).toBe("");
      expect(formatDate(undefined)).toBe("");
    });

    it("returns original string for invalid date", () => {
      const result = formatDate("not-a-date");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("formatTimeAgo", () => {
    it("returns 'Just now' for very recent dates", () => {
      const now = new Date();
      const twoSecondsAgo = new Date(now.getTime() - 2000);
      expect(formatTimeAgo(twoSecondsAgo)).toBe("Just now");
    });

    it("formats seconds ago", () => {
      const now = new Date();
      const fifteenSecondsAgo = new Date(now.getTime() - 15000);
      expect(formatTimeAgo(fifteenSecondsAgo)).toMatch(/\d+seconds ago/);
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

    it("falls back to formatDate for dates older than 30 days", () => {
      const now = new Date();
      const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
      const result = formatTimeAgo(fortyDaysAgo);
      expect(result).not.toContain("days ago");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("formatPath", () => {
    it.each([
      ["", ""],
      ["/home", "/home"],
      ["/home/user/docs", ".../user/docs"],
      ["/very/long/path/to/file.txt", ".../to/file.txt"],
      ["/a/b/c/d/e/f/g.txt", ".../f/g.txt"],
    ])("formats %s → %s", (input, expected) => {
      expect(formatPath(input)).toBe(expected);
    });

    it("truncates to maxLength", () => {
      expect(formatPath("/very/long/path/to/file.txt", 10)).toBe(".../file.txt");
    });
  });

  describe("truncateText", () => {
    it.each([
      ["hello", 10, "hello"],
      ["hello world", 8, "hello..."],
      ["short", 5, "short"],
      ["longer text here", 10, "longer ..."],
    ])("truncates '%s' to max %d → '%s'", (text, max, expected) => {
      expect(truncateText(text, max)).toBe(expected);
    });

    it("uses custom suffix", () => {
      expect(truncateText("hello world", 8, "..")).toBe("hello ..");
    });
  });

  describe("formatNumber", () => {
    it.each([
      [0, "0"],
      [1000, "1,000"],
      [1234567, "1,234,567"],
      [-500, "-500"],
    ])("formats %d → %s", (num, expected) => {
      expect(formatNumber(num)).toBe(expected);
    });
  });

  describe("formatMarkdown", () => {
    it("formats code blocks", () => {
      const input = "```js\nconst x = 1;\n```";
      expect(formatMarkdown(input)).toContain('<pre class="code-block">');
    });

    it("formats inline code", () => {
      const input = "use `console.log` for output";
      expect(formatMarkdown(input)).toContain('<code class="inline-code">console.log</code>');
    });

    it("formats bold text", () => {
      const input = "**bold**";
      expect(formatMarkdown(input)).toBe("<strong>bold</strong>");
    });

    it("formats italic text", () => {
      const input = "*italic*";
      expect(formatMarkdown(input)).toBe("<em>italic</em>");
    });

    it("converts newlines to br tags", () => {
      const input = "line1\nline2";
      expect(formatMarkdown(input)).toBe("line1<br />line2");
    });

    it("returns empty string for empty input", () => {
      expect(formatMarkdown("")).toBe("");
    });
  });

  describe("getFileExtension", () => {
    it.each([
      ["file.txt", "txt"],
      ["image.PNG", "png"],
      ["archive.tar.gz", "gz"],
      ["no-extension", ""],
      [".gitignore", "gitignore"],
    ])("gets extension of %s → %s", (input, expected) => {
      expect(getFileExtension(input)).toBe(expected);
    });
  });

  describe("getFileNameWithoutExt", () => {
    it.each([
      ["file.txt", "file"],
      ["image.png", "image"],
      ["archive.tar.gz", "archive.tar"],
      ["README", "README"],
      [".env", ""],
    ])("removes extension from %s → %s", (input, expected) => {
      expect(getFileNameWithoutExt(input)).toBe(expected);
    });
  });

  describe("formatDuration", () => {
    it.each([
      [0, "0ms"],
      [500, "500ms"],
      [1000, "1.0s"],
      [1500, "1.5s"],
      [60000, "1m 0s"],
      [90000, "1m 30s"],
      [123456, "2m 3s"],
    ])("formats %d ms → %s", (ms, expected) => {
      expect(formatDuration(ms)).toBe(expected);
    });
  });
});
