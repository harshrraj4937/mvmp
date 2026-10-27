import { z } from "zod";

import { logger } from "./logger";
import { REQUEST_ID_HEADER, resolveRequestId } from "./request-id";

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

const noStore = { "Cache-Control": "no-store" };

/** Route handler wrapper: request id, AppError mapping, no caching. */
export function apiRoute<C>(
  handler: (
    request: Request,
    context: C,
    requestId: string,
  ) => Promise<Response>,
): (request: Request, context: C) => Promise<Response> {
  return async (request, context) => {
    const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
    try {
      return await handler(request, context, requestId);
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof AppError) {
    const body = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
      requestId,
    };
    return Response.json(body, { headers: noStore, status: error.status });
  }
  logger.error({ err: error, requestId }, "unhandled api error");
  return Response.json(
    {
      error: { code: "internal_error", message: "Something went wrong." },
      requestId,
    },
    { headers: noStore, status: 500 },
  );
}

export function ok(data: unknown, status = 200): Response {
  return Response.json({ data }, { headers: noStore, status });
}

/** Parses a JSON body; bad JSON or schema failures become a 400. */
export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be JSON.");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(
      "Some fields are not valid.",
      z.flattenError(result.error).fieldErrors,
    );
  }
  return result.data;
}
