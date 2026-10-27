import pino from "pino";

import { getServerEnv } from "./env";

const secretKeys = ["authorization", "cookie", "password", "secret", "token"];

/** Structured JSON logs (stdout by default); secrets are redacted by key name. */
export function createLogger(
  destination?: pino.DestinationStream,
): pino.Logger {
  return pino(
    {
      base: { service: process.env.GILLU_SERVICE ?? "web" },
      level: getServerEnv().LOG_LEVEL,
      redact: {
        censor: "[redacted]",
        // pino's "*.key" matches one level down only; list top level too.
        paths: secretKeys.flatMap((key) => [key, `*.${key}`]),
      },
    },
    destination,
  );
}

export const logger: pino.Logger = createLogger();
