import { conn } from "~/db";
import { checkDatabaseHealth } from "~/platform/health";
import { logger } from "~/platform/logger";
import { REQUEST_ID_HEADER } from "~/platform/request-id";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const database = await checkDatabaseHealth(conn);
  const healthy = database === "ok";
  if (!healthy) {
    logger.warn(
      { database, requestId: request.headers.get(REQUEST_ID_HEADER) },
      "health check failed",
    );
  }
  return Response.json(
    { checks: { database }, status: healthy ? "ok" : "degraded" },
    {
      headers: { "Cache-Control": "no-store" },
      status: healthy ? 200 : 503,
    },
  );
}
