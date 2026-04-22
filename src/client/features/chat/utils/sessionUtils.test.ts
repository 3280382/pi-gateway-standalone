import { describe, expect, it } from "vitest";
import { extractShortSessionId, formatSessionId } from "./sessionUtils";

describe("sessionUtils", () => {
  describe("extractShortSessionId", () => {
    it.each([
      ["", ""],
      ["/path/to/2026-04-17T08-26-10-585Z_019d9a8c-2b19-7345-94f5-5efedb498871.jsonl", "019d9a8c"],
      ["2026-04-17T08-26-10-585Z_019d9a8c-2b19-7345-94f5-5efedb498871.jsonl", "019d9a8c"],
      ["abc123.jsonl", "abc123"],
      ["short", "short"],
    ])("extracts short id from %s → %s", (input, expected) => {
      expect(extractShortSessionId(input)).toBe(expected);
    });
  });

  describe("formatSessionId", () => {
    it("returns empty string for null/undefined", () => {
      expect(formatSessionId(null)).toBe("");
      expect(formatSessionId(undefined)).toBe("");
    });

    it("returns short ids as-is", () => {
      expect(formatSessionId("abc123")).toBe("abc123");
    });

    it("extracts short id from long session file path", () => {
      const longId = "2026-04-17T08-26-10-585Z_019d9a8c-2b19-7345-94f5-5efedb498871.jsonl";
      expect(formatSessionId(longId)).toBe("019d9a8c");
    });
  });
});
