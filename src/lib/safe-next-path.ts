const PROBE_ORIGIN = "http://next.invalid";

/**
 * Returns `raw` when it is a same-site path that is safe to redirect to
 * after sign-in, otherwise null. Rejects protocol-relative (`//x`),
 * backslash and absolute URLs, also when they are percent-encoded, and
 * control characters (URL parsing drops tabs and newlines, so `/\t/x.com`
 * would resolve to `https://x.com/`).
 */
export function safeNextPath(raw: null | string | undefined): null | string {
  if (!raw) {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  for (const value of [raw, decoded]) {
    if (
      !value.startsWith("/") ||
      value.startsWith("//") ||
      value.includes("\\") ||
      value.includes("/%2F") ||
      value.includes("/%2f") ||
      value.trim() !== value ||
      hasControlCharacter(value) ||
      new URL(value, PROBE_ORIGIN).origin !== PROBE_ORIGIN
    ) {
      return null;
    }
  }
  return raw;
}

/** C0 control characters (tab, CR, LF, …) and DEL. */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}
