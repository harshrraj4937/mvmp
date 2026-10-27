/**
 * An error whose code and message are safe to show to the caller.
 * Anything else that reaches an API route becomes a generic 500.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 409, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You are not allowed to do that.", details?: unknown) {
    super("forbidden", message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.", details?: unknown) {
    super("not_found", message, 404, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sign in to continue.", details?: unknown) {
    super("unauthorized", message, 401, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Some fields are not valid.", details?: unknown) {
    super("validation_failed", message, 400, details);
  }
}
