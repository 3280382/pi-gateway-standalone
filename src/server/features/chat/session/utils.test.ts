import { describe, expect, it } from "vitest";
import {
  AGENT_DIR,
  encodeCwd,
  expandPath,
  extractSessionIdFromPath,
  getLocalSessionsDir,
  safeFileName,
} from "./utils.js";

describe("session/utils", () => {
  describe("encodeCwd", () => {
    it.each([
      ["/root/project", "--root-project--"],
      ["/home/user/docs", "--home-user-docs--"],
      ["C:\\Users\\dev", "--C--Users-dev--"],
      ["/", "----"],
      ["/a/b/c/d", "--a-b-c-d--"],
    ])("encodes %s → %s", (input, expected) => {
      expect(encodeCwd(input)).toBe(expected);
    });
  });

  describe("getLocalSessionsDir", () => {
    it("returns path within AGENT_DIR", () => {
      const result = getLocalSessionsDir("/root/project");
      expect(result.startsWith(AGENT_DIR)).toBe(true);
      expect(result).toContain("sessions");
      expect(result).toContain("--root-project--");
    });
  });

  describe("expandPath", () => {
    it.each([
      ["~", process.env.HOME || "/root"],
      ["~/documents", `${process.env.HOME || "/root"}/documents`],
      ["/absolute/path", "/absolute/path"],
    ])("expands %s", (input, expected) => {
      expect(expandPath(input)).toBe(expected);
    });

    it("resolves relative paths", () => {
      const result = expandPath("relative/path");
      expect(result.startsWith("/")).toBe(true);
    });
  });

  describe("extractSessionIdFromPath", () => {
    it.each([
      ["/path/to/session-123.jsonl", "session-123"],
      ["session-abc.jsonl", "session-abc"],
      ["/a/b/c/my-session.jsonl", "my-session"],
    ])("extracts id from %s", (input, expected) => {
      expect(extractSessionIdFromPath(input)).toBe(expected);
    });

    it("returns empty string for empty input", () => {
      expect(extractSessionIdFromPath("")).toBe("");
    });
  });

  describe("safeFileName", () => {
    it.each([
      ["normal.txt", "normal.txt"],
      ["file with spaces.txt", "file_with_spaces.txt"],
      ["special!@#.txt", "special_.txt"],
      ["multiple___underscores.txt", "multiple_underscores.txt"],
      ["__leading_trailing__", "leading_trailing"],
    ])("sanitizes %s → %s", (input, expected) => {
      expect(safeFileName(input)).toBe(expected);
    });
  });
});
