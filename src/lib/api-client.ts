"use client";

/** The `/api/v1` error shape (see docs/api-contracts.md). */
export interface ApiError {
  code: string;
  details?: unknown;
  message: string;
}

export type ApiResult<T> =
  | { data: T; error?: undefined }
  | { data?: undefined; error: ApiError };

/** Field messages from a 400 validation error, keyed by top-level field. */
export function fieldErrors(
  error: ApiError | undefined,
): Record<string, string> {
  if (error?.code !== "validation_failed" || !error.details) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(error.details as Record<string, string[] | undefined>)
      .filter((entry): entry is [string, string[]] => Boolean(entry[1]?.[0]))
      .map(([field, messages]) => [field, messages[0] ?? ""]),
  );
}

export async function sendJson<T>(
  path: string,
  method: "PATCH" | "POST",
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method,
    });
    const json = (await response.json()) as { data?: T; error?: ApiError };
    if (!response.ok || json.error) {
      return {
        error: json.error ?? {
          code: `http_${response.status}`,
          message: "Something went wrong. Please try again.",
        },
      };
    }
    return { data: json.data as T };
  } catch {
    return {
      error: {
        code: "network_error",
        message: "Could not reach Gillu. Check your connection and try again.",
      },
    };
  }
}
