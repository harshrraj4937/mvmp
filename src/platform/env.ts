import { z } from "zod";

// Empty strings in env files mean "not configured".
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const serverEnvSchema = z.object({
  AUTH_GITHUB_ID: optionalString,
  AUTH_GITHUB_SECRET: optionalString,
  AUTH_GOOGLE_ID: optionalString,
  AUTH_GOOGLE_SECRET: optionalString,
  AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z
    .url()
    .refine(
      (url) => url.startsWith("postgres://") || url.startsWith("postgresql://"),
    ),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_SERVER_APP_URL: z.url(),
  REDIS_URL: optionalString,
  UPLOADTHING_TOKEN: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates server configuration. Error messages name the failing
 * variables only, never their values, so secrets never reach logs.
 */
export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Invalid server environment: ${names.join(", ")}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
