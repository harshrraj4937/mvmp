import { z } from "zod";

import { AppError, ValidationError } from "./errors";
import { logger } from "./logger";
import { REQUEST_ID_HEADER, resolveRequestId } from "./request-id";

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
      fieldDetails(result.error),
    );
  }
  return result.data;
}

/** Parses URL search params (first value per name); failures become a 400. */
export function parseQuery<T>(request: Request, schema: z.ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ValidationError(
      "Some parameters are not valid.",
      z.flattenError(result.error).fieldErrors,
    );
  }
  return result.data;
}

/**
 * Messages per top-level field (z.flattenError), plus each nested issue
 * under its dotted path ("variant.price") so forms can show it by its input.
 */
function fieldDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {
    ...(z.flattenError(error).fieldErrors as Record<string, string[]>),
  };
  for (const issue of error.issues) {
    if (issue.path.length > 1) {
      const key = issue.path.map(String).join(".");
      details[key] = [...(details[key] ?? []), issue.message];
    }
  }
  return details;
}
