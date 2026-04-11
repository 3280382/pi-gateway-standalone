/**
 * Base error definitions
 */

export class ApiError extends Error {
  public code: string;
  public statusCode: number;
  public details?: Record<string, any>;

  constructor(code: string, message: string, statusCode = 500, details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} ${id} not found` : `${resource} not found`;
    super("NOT_FOUND", message, 404, { resource, id });
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, any>) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

export class ErrorFactory {
  static notFound(resource: string, id?: string): NotFoundError {
    return new NotFoundError(resource, id);
  }

  static validation(message: string, details?: Record<string, any>): ValidationError {
    return new ValidationError(message, details);
  }
}
