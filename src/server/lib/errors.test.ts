import { describe, expect, it } from "vitest";
import { ApiError, ErrorFactory, NotFoundError, ValidationError } from "./errors.js";

describe("errors", () => {
  describe("ApiError", () => {
    it("creates error with default status code", () => {
      const error = new ApiError("TEST_ERROR", "Something went wrong");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.message).toBe("Something went wrong");
      expect(error.statusCode).toBe(500);
      expect(error.details).toBeUndefined();
    });

    it("creates error with custom status code and details", () => {
      const error = new ApiError("CUSTOM", "Custom error", 400, { field: "name" });
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: "name" });
    });

    it("is an instance of Error", () => {
      const error = new ApiError("TEST", "test");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
    });
  });

  describe("NotFoundError", () => {
    it("creates error with resource name", () => {
      const error = new NotFoundError("User");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("User not found");
      expect(error.statusCode).toBe(404);
    });

    it("creates error with resource and id", () => {
      const error = new NotFoundError("Session", "123");
      expect(error.message).toBe("Session 123 not found");
      expect(error.details).toEqual({ resource: "Session", id: "123" });
    });
  });

  describe("ValidationError", () => {
    it("creates validation error", () => {
      const error = new ValidationError("Name is required");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toBe("Name is required");
      expect(error.statusCode).toBe(400);
    });

    it("creates validation error with details", () => {
      const error = new ValidationError("Invalid input", { field: "email" });
      expect(error.details).toEqual({ field: "email" });
    });
  });

  describe("ErrorFactory", () => {
    it("creates notFound error", () => {
      const error = ErrorFactory.notFound("File");
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe("File not found");
    });

    it("creates validation error", () => {
      const error = ErrorFactory.validation("Invalid path");
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("Invalid path");
    });
  });
});
