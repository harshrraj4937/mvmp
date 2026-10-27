export const REQUEST_ID_HEADER = "x-request-id";

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Reuses a caller-supplied correlation id only when it is safe to log;
 * anything else (missing, too long, control characters) gets a fresh id.
 */
export function resolveRequestId(incoming: null | string): string {
  return incoming && SAFE_REQUEST_ID.test(incoming)
    ? incoming
    : crypto.randomUUID();
}
