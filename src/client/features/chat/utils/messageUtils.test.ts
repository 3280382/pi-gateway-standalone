import { describe, expect, it } from "vitest";
import { handleServerMessages } from "./messageUtils";

describe("messageUtils", () => {
  describe("handleServerMessages", () => {
    it("returns empty array for empty input", () => {
      expect(handleServerMessages([])).toEqual([]);
    });

    it("returns empty array for null/undefined", () => {
      expect(handleServerMessages(null as any)).toEqual([]);
      expect(handleServerMessages(undefined as any)).toEqual([]);
    });

    it("returns messages as-is", () => {
      const messages = [{ id: "1", text: "hello" }];
      expect(handleServerMessages(messages)).toEqual(messages);
    });
  });
});
