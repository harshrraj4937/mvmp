import pino from "pino";

import { getServerEnv } from "./env";

/** Structured JSON logs on stdout; secrets are redacted by key name. */
export const logger: pino.Logger = pino({
  base: { service: process.env.GILLU_SERVICE ?? "web" },
  level: getServerEnv().LOG_LEVEL,
  redact: {
    censor: "[redacted]",
    paths: ["*.password", "*.token", "*.secret", "*.authorization", "*.cookie"],
  },
});
