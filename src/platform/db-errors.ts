/**
 * The constraint name when `error` (or its cause, as wrapped by drizzle) is
 * a Postgres unique violation (23505), otherwise null.
 */
export function uniqueViolation(error: unknown): null | string {
  for (let current = error; current instanceof Object; ) {
    const { cause, code, constraint_name } = current as {
      cause?: unknown;
      code?: unknown;
      constraint_name?: unknown;
    };
    if (code === "23505") {
      return typeof constraint_name === "string" ? constraint_name : "";
    }
    current = cause;
  }
  return null;
}
